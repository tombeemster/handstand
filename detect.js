// When a handstand starts and ends, from pose landmarks. No page, no clock: the caller passes each
// frame's time and size. tools/replay.py copies these rules to test on recorded videos: change both.

// Ankles get a lower bar: in loose trousers the model places them right but scores them ~0.3–0.45
export const VIS = 0.5, ANKLE_VIS = 0.3, MIN_MS = 1000;
const CONFIRM = 3, LOST_MS = 500, HISTORY_MS = 2000;
// An attempt that restarts within MERGE_MS of ending was one attempt: nobody lands and kicks up
// again that fast, but the model can lose her for a moment (e.g. someone walking past)
const MERGE_MS = 600;
// Lock: the first person seen is the athlete. After that only a pose near her last position counts
// (reach grows by SPEED body-heights per second unseen), so phantoms and passers-by are skipped.
// Unseen for LOCK_MS between attempts releases the lock: the next person seen is the athlete.
// (Locking on with a salute was tried and dropped: it was often forgotten, and every attempt
// before it went untimed.)
const SPEED = 1.5, LOCK_MS = 2000;
// Framing hints: a landmark closer than EDGE to the frame's edge counts as out of frame
const EDGE = 0.03;

// Why the athlete doesn't fit the frame, in words, or null
export function framingHint(lm) {
  const off = i => lm[i].x < EDGE || lm[i].x > 1 - EDGE || lm[i].y < EDGE || lm[i].y > 1 - EDGE;
  if (off(15) || off(16)) return 'Hands out of frame – step back';
  if (off(27) || off(28)) return 'Feet out of frame – step back';
  if (off(0)) return 'Head out of frame – step back';
  return null;
}

// events: onStart(ts, resumed), onEnd(startTs, endTs, flagged)
// resumed: the previous attempt continues, so whatever it logged should go
export function createDetector({ onStart, onEnd }) {
  let W = 1, H = 1;                                 // frame size in pixels
  let startTs, last, invRun, downRun, downTs, seenTs, hist;
  let athlete, size;                                // athlete: { x, y, ts }, hip centre when last seen; size: her height (fraction of frame)
  reset();

  function reset() {
    startTs = last = athlete = null;
    invRun = downRun = downTs = seenTs = 0;
    hist = [];
    size = 0.5;
  }

  const hipCentre = lm => [(lm[23].x + lm[24].x) / 2 * W, (lm[23].y + lm[24].y) / 2 * H];
  // Height of the visible body, as a fraction of the frame
  const extent = lm => {
    const ys = lm.filter(p => p.visibility > VIS).map(p => p.y);
    return ys.length ? Math.max(0.1, Math.max(...ys) - Math.min(...ys)) : 0.3;
  };

  // The pose that is the athlete this frame, or null. Phantoms elsewhere in the room are skipped.
  function pickAthlete(poses, ts) {
    if (athlete && startTs === null && ts - athlete.ts > LOCK_MS) athlete = null;
    if (!athlete) {
      if (!poses[0]) return null;
      athlete = { x: hipCentre(poses[0])[0], y: hipCentre(poses[0])[1], ts };
      size = extent(poses[0]);
      return poses[0];
    }
    let pick = null, reach = (0.3 + SPEED * (ts - athlete.ts) / 1000) * size * H;
    for (const lm of poses) {
      const [x, y] = hipCentre(lm), d = Math.hypot(x - athlete.x, y - athlete.y);
      if (d <= reach) { pick = lm; reach = d; }
    }
    if (pick) {
      [athlete.x, athlete.y, athlete.ts] = [...hipCentre(pick), ts];
      size = 0.8 * size + 0.2 * extent(pick);
    }
    return pick;
  }

  // Within 45° of vertical, wrists to ankles, in pixels. A phantom "person" lying sideways
  // (e.g. found in the clutter on a table) passes the top-to-bottom order checks by a hair.
  function upright(lm) {
    const centre = (ids, vis) => {
      const ps = ids.map(i => lm[i]).filter(p => p.visibility > vis);
      return [ps.reduce((a, p) => a + p.x, 0) / ps.length * W, ps.reduce((a, p) => a + p.y, 0) / ps.length * H];
    };
    const [wx, wy] = centre([15, 16], VIS), [ax, ay] = centre([27, 28], ANKLE_VIS);
    return Math.abs(wy - ay) > Math.abs(wx - ax);
  }

  function finish(endTs, flagged = false) {
    const start = startTs;
    last = { start, end: endTs };
    startTs = null; invRun = 0;
    onEnd(start, endTs, flagged);
  }

  function step(ts, lm) {
    const ys = (ids, vis = VIS) => lm ? ids.filter(i => lm[i].visibility > vis).map(i => lm[i].y) : [];
    const wrists = ys([15, 16]), hips = ys([23, 24]), ankles = ys([27, 28], ANKLE_VIS);
    const tracked = hips.length > 0 && ankles.length > 0;
    const hip = hips.reduce((a, b) => a + b, 0) / hips.length;
    const wrist = wrists.length ? Math.max(...wrists) : null;   // image y grows downward

    hist.push({ ts, wrist, feetDown: tracked && ankles.some(y => y > hip) });
    while (hist[0].ts < ts - HISTORY_MS) hist.shift();

    if (startTs === null) {
      // a real attempt starts with a kick-up: feet below the hips shortly before. Static objects
      // mistaken for a person (e.g. pillows) never do that, so they can't start an attempt.
      const inverted = tracked && wrist !== null && ankles.every(y => y < hip) && hip < wrist && upright(lm) && hist.some(f => f.feetDown);
      invRun = inverted ? invRun + 1 : 0;
      if (invRun >= CONFIRM) {
        // backdate to the first frame the wrists were already planted where they are now
        // (frames without wrists are skipped: the model drops single frames during a kick-up)
        const tol = (wrist - hip) * 0.2;
        let t = ts;
        for (let i = hist.length - 1; i >= 0; i--) {
          if (hist[i].wrist === null) continue;
          if (Math.abs(hist[i].wrist - wrist) > tol) break;
          t = hist[i].ts;
        }
        const resumed = last !== null && t - last.end < MERGE_MS;   // same attempt, continued
        startTs = resumed ? last.start : t; seenTs = ts; downRun = 0;
        onStart(startTs, resumed);
      }
    } else {
      // Head above the hips mid-attempt: the model has fitted her the wrong way up (after a dropped
      // frame, and in front-on views). Its "wrists" are then on her feet, so read them as the feet.
      const flipped = lm && lm[0].visibility > VIS && lm[0].y < hip;
      const feet = flipped ? [lm[15].y, lm[16].y] : ankles;
      if (!hips.length || !feet.length) {
        if (ts - seenTs > LOST_MS) finish(seenTs, true);
      } else {
        seenTs = ts;
        if (feet.some(y => y > hip)) {
          if (!downRun++) downTs = ts;
          if (downRun >= CONFIRM) finish(downTs);
        } else downRun = 0;
      }
    }
  }

  return {
    // One video frame: all poses the model found. Returns the athlete's pose, or undefined.
    frame(ts, poses, width, height) {
      W = width; H = height;
      const lm = pickAthlete(poses, ts) ?? undefined;
      step(ts, lm);
      return lm;
    },
    reset,
    get state() {
      return { startTs, locked: athlete !== null, invRun, downRun, confirm: CONFIRM };
    },
  };
}
