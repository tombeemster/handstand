// When a handstand starts and ends, from pose landmarks. No page, no clock: the caller passes each
// frame's time and size. tools/replay.py runs this file on recorded videos (through Node), to test a change.

// Ankles get a lower bar: in loose trousers the model places them right but scores them ~0.3–0.45
export const VIS = 0.5, ANKLE_VIS = 0.3, MIN_MS = 1000;
// HISTORY_MS: how far back frames are kept, for the standing check (STAND_MS). The start is backdated
// at most BACKDATE_MS, the 2 s it always had: keeping 3 s of frames shouldn't stretch hesitant starts.
const CONFIRM = 3, LOST_MS = 500, HISTORY_MS = 3000, BACKDATE_MS = 2000;
// A real handstand is kicked up from standing: she stood upright with straight legs at most STAND_MS
// before the handstand is confirmed. Measured: real kick-ups 0.17–0.83 s (phone), 1.2–1.27 s (15 fps
// webcam); a headstand from kneeling with the hands already down 2.9 s, other headstands never stood.
// (Measuring to when the hands land instead was tried: hands placed while kneeling fooled it.)
const STAND_MS = 1500;
// An attempt that restarts within MERGE_MS of ending was one attempt: nobody lands and kicks up
// again that fast, but the model can lose her for a moment (e.g. someone walking past)
export const MERGE_MS = 600;
// Lock: the first person seen is the athlete. After that only a pose near her last position counts
// (reach grows by SPEED body-heights per second unseen), so phantoms and passers-by are skipped.
// Unseen for LOCK_MS between attempts releases the lock: the next person seen is the athlete.
// (Locking on with a salute was tried and dropped: it was often forgotten, and every attempt
// before it went untimed.)
const SPEED = 1.5, LOCK_MS = 2000;
// A pose under MIN_SIZE times her size is a phantom, never her: also when re-locking after she was out
// of view. (Without it the lock moved to a small "person" found in a mattress while she was away, and
// that phantom's size then made her too far away to accept when she came back.)
const MIN_SIZE = 0.5;
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

// Wrists below the hips below the ankles: upside down, going by the order alone
const orderInverted = lm => {
  const hip = (lm[23].y + lm[24].y) / 2;
  const ankles = [27, 28].filter(i => lm[i].visibility > ANKLE_VIS).map(i => lm[i].y);
  const wrists = [15, 16].filter(i => lm[i].visibility > VIS).map(i => lm[i].y);
  return ankles.length > 0 && wrists.length > 0 && ankles.every(y => y < hip) && hip < Math.max(...wrists);
};

// Standing with both wrists above the nose. Also how the model reads a straight, front-on handstand
// that it fits the wrong way up from the very first frame: her feet as raised hands, her hands as feet.
// When it reads her like this the app also analyses the frame upside down (see frame()).
export function armsUp(lm) {
  const hip = (lm[23].y + lm[24].y) / 2;
  return lm[15].visibility > VIS && lm[16].visibility > VIS && lm[15].y < lm[0].y && lm[16].y < lm[0].y
    && Math.max(lm[27].y, lm[28].y) > hip;
}

// Near misses: she was seen upside down for at least MISS_MS but no attempt started. The reason is the
// furthest check she got to (by MISS_REASONS order), so a live session shows which rule cost an attempt.
const MISS_MS = 500;
const MISS_REASONS = ['lock on someone else', 'not steady 3 frames in a row', 'body not vertical', 'not seen standing first'];

// events: onStart(ts, resumed), onEnd(startTs, endTs, flagged), onMiss(ts, reason)
// resumed: the previous attempt continues, so whatever it logged should go
export function createDetector({ onStart, onEnd, onMiss = () => {} }) {
  let W = 1, H = 1;                                 // frame size in pixels
  let startTs, last, invRun, downRun, downTs, seenTs, hist, missFrom, missWhy;
  let athlete, size, sized;                         // athlete: { x, y, ts }, hip centre when last seen; size: her height (fraction of frame); sized: size measured
  reset();

  function reset() {
    startTs = last = athlete = missFrom = missWhy = null;
    invRun = downRun = downTs = seenTs = 0;
    hist = [];
    size = 0.5;
    sized = false;
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
    const candidates = sized ? poses.filter(lm => extent(lm) >= MIN_SIZE * size) : poses;
    if (!athlete) {   // the first person seen is the athlete; once her size is known, one about her size
      if (!candidates[0]) return null;
      athlete = { x: hipCentre(candidates[0])[0], y: hipCentre(candidates[0])[1], ts };
      size = extent(candidates[0]);
      sized = true;
      return candidates[0];
    }
    let pick = null, reach = (0.3 + SPEED * (ts - athlete.ts) / 1000) * size * H;
    for (const lm of candidates) {
      const [x, y] = hipCentre(lm), d = Math.hypot(x - athlete.x, y - athlete.y);
      if (d <= reach) { pick = lm; reach = d; }
    }
    if (pick) {
      [athlete.x, athlete.y, athlete.ts] = [...hipCentre(pick), ts];
      size = 0.8 * size + 0.2 * extent(pick);
    }
    return pick;
  }

  // Standing upright with straight legs: shoulders above hips, and the ankles at least one torso length
  // (shoulders to hips) below the hips. Sitting or crouching puts the feet near the hips. The head must
  // be above the shoulders too, but only when it's visible: with her back to the camera the nose can
  // score too low, and a real kick-up shouldn't be rejected for that.
  function standing(lm) {
    if (!lm || [11, 12, 23, 24].some(i => lm[i].visibility <= VIS)) return false;
    const ankles = [27, 28].filter(i => lm[i].visibility > ANKLE_VIS).map(i => lm[i].y);
    if (!ankles.length) return false;
    const shoulder = (lm[11].y + lm[12].y) / 2, hip = (lm[23].y + lm[24].y) / 2, torso = hip - shoulder;
    const headUp = lm[0].visibility <= VIS || lm[0].y < shoulder;
    return torso > 0.02 && headUp && Math.max(...ankles) - hip >= torso;
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

  // A near miss in the making: note the furthest reason, and report it once she's no longer upside down
  function trackMiss(ts, upsideDown, why) {
    if (upsideDown && startTs === null) {
      missFrom ??= ts;
      if (MISS_REASONS.indexOf(why) > MISS_REASONS.indexOf(missWhy)) missWhy = why;
      return;
    }
    if (missFrom !== null && startTs === null && ts - missFrom >= MISS_MS) onMiss(missFrom, missWhy ?? MISS_REASONS[0]);
    missFrom = missWhy = null;
  }

  function step(ts, lm, othersUpsideDown) {
    const ys = (ids, vis = VIS) => lm ? ids.filter(i => lm[i].visibility > vis).map(i => lm[i].y) : [];
    const wrists = ys([15, 16]), hips = ys([23, 24]), ankles = ys([27, 28], ANKLE_VIS);
    const tracked = hips.length > 0 && ankles.length > 0;
    const hip = hips.reduce((a, b) => a + b, 0) / hips.length;
    const wrist = wrists.length ? Math.max(...wrists) : null;   // image y grows downward

    hist.push({ ts, wrist, standing: standing(lm) });
    while (hist[0].ts < ts - HISTORY_MS) hist.shift();

    if (startTs === null) {
      const ordered = tracked && wrist !== null && orderInverted(lm);
      const inverted = ordered && upright(lm);
      invRun = inverted ? invRun + 1 : 0;
      trackMiss(ts, ordered || othersUpsideDown,
        inverted ? 'not steady 3 frames in a row' : ordered ? 'body not vertical' : 'lock on someone else');
      if (invRun >= CONFIRM) {
        // backdate to the first frame the wrists were already planted where they are now
        // (frames without wrists are skipped: the model drops single frames during a kick-up)
        const tol = (wrist - hip) * 0.2;
        let t = ts;
        for (let i = hist.length - 1; i >= 0 && ts - hist[i].ts <= BACKDATE_MS; i--) {
          if (hist[i].wrist === null) continue;
          if (Math.abs(hist[i].wrist - wrist) > tol) break;
          t = hist[i].ts;
        }
        const resumed = last !== null && t - last.end < MERGE_MS;   // same attempt, continued
        // kicked up from standing (see STAND_MS); static phantoms (pillows) never stand either
        const kickedUp = hist.some(f => f.standing && ts - f.ts <= STAND_MS);
        if (resumed || kickedUp) {
          startTs = resumed ? last.start : t; seenTs = ts; downRun = 0;
          missFrom = missWhy = null;
          onStart(startTs, resumed);
        } else trackMiss(ts, true, 'not seen standing first');
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
    // flipped: a function giving what the model finds in the frame turned upside down (turned back),
    // called only when it can matter, as it costs a second run of the model: before an attempt, when the
    // normal reading has her standing with her arms up (armsUp). If the upside-down reading then has her
    // upside down in the same spot, it's a handstand the model fitted the wrong way up, and that reading
    // is used. (Tested: it found 4 front-on handstands missed entirely, and changed nothing else.)
    frame(ts, poses, width, height, flipped = () => []) {
      W = width; H = height;
      let lm = pickAthlete(poses, ts) ?? undefined;
      if (startTs === null && lm && armsUp(lm) && !orderInverted(lm)) {
        const alt = flipped()[0];
        if (alt && orderInverted(alt)) {
          const [x1, y1] = hipCentre(lm), [x2, y2] = hipCentre(alt);
          if (Math.hypot(x1 - x2, y1 - y2) <= size * H) lm = alt;
        }
      }
      step(ts, lm, poses.some(p => p !== lm && orderInverted(p)));
      return lm;
    },
    reset,
    get state() {
      return { startTs, locked: athlete !== null, invRun, downRun, confirm: CONFIRM };
    },
  };
}
