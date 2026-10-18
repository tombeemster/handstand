import { createDetector, framingHint, VIS, ANKLE_VIS, MIN_MS } from './detect.js';

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
// NUM_POSES 2 was tried: the model then reports one body twice (upright and flipped), worse.
const NUM_POSES = 1;
const BONES = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
const KEY = 'handstand.attempts', CAMERA_KEY = 'handstand.camera';
const LATEST = 5;   // at most this many attempts on the home screen, all from her last practice day

const $ = id => document.getElementById(id);
const fmt = ms => (ms / 1000).toFixed(2);
// Local time as ISO 8601 without a zone, e.g. 2026-10-11T18:04:12
const localIso = d => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);

// ---- log (newest first) ----
let attempts = JSON.parse(localStorage.getItem(KEY) || '[]');
const best = () => Math.max(0, ...attempts.map(a => a.duration_ms));
// The attempts that set a new all-time record when they happened, oldest first
function recordIds() {
  const ids = new Set();
  let record = 0;
  for (const a of [...attempts].sort((p, q) => p.started_at.localeCompare(q.started_at))) {
    if (a.duration_ms > record) { record = a.duration_ms; ids.add(a.id); }
  }
  return ids;
}
// The average of every attempt ever: shown in the average tile and as the chart's dashed line
const overallAverage = () => attempts.length ? attempts.reduce((s, a) => s + a.duration_ms, 0) / attempts.length : null;

function save() {
  localStorage.setItem(KEY, JSON.stringify(attempts));
  renderHome();
  renderLog();
}

// When an attempt started, day first: 18/10/2026 – 07:16:09
const stamp = a => `${a.started_at.slice(8, 10)}/${a.started_at.slice(5, 7)}/${a.started_at.slice(0, 4)} – ${a.started_at.slice(11)}`;

// Attempts as one card per day, on the home screen and in the log: the date on top, then each
// attempt's time of day and duration. Attempts that set a record at the time are marked "best".
// footer: shown at the bottom of the last card.
function dayCards(list, footer = '') {
  const records = recordIds(), byDay = new Map();
  for (const a of list) {
    const day = a.started_at.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), a]);
  }
  return [...byDay].map(([day, items], i, days) => `
    <div class="day">
      <div class="day-label">${new Date(day + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <ul>${items.map(a => `<li class="${records.has(a.id) ? 'best' : ''}" data-id="${a.id}">
        <time>${stamp(a)}</time><strong>${fmt(a.duration_ms)}s</strong>
      </li>`).join('')}</ul>
      ${i === days.length - 1 ? footer : ''}
    </div>`).join('');
}

// Tapping an attempt, on the home screen or in the log, offers to delete it (false starts, mis-timed holds)
function onAttemptTap(e) {
  const li = e.target.closest('li[data-id]');
  const a = li && attempts.find(a => a.id === li.dataset.id);
  if (a && confirm(`Delete the attempt of ${stamp(a)} (${fmt(a.duration_ms)}s)?`)) {
    attempts = attempts.filter(x => x.id !== a.id);
    save();
  }
}

// ---- screens: #home (or none), #record, #log, one tab each. The camera is on only on #record. ----
const SCREENS = ['home', 'record', 'log'];

function route() {
  const name = location.hash.slice(1);
  const screen = SCREENS.includes(name) ? name : 'home';
  for (const s of SCREENS) $(s).hidden = s !== screen;
  for (const tab of $('tabs').querySelectorAll('a')) {
    if (tab.hash === '#' + screen) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  if (screen === 'record' && !live) startSession();
  if (screen !== 'record' && live) endSession();
}
addEventListener('hashchange', route);

// ---- home ----
function renderHome() {
  const pb = best();
  $('best').textContent = pb ? fmt(pb) + ' s' : '–';
  const avg = overallAverage();
  $('average').textContent = avg ? fmt(avg) + ' s' : '–';
  // one card: the latest attempts of the last day she practised, at most LATEST
  const lastDay = attempts.reduce((day, a) => a.started_at > day ? a.started_at : day, '').slice(0, 10);
  const latest = attempts.filter(a => a.started_at.startsWith(lastDay))
    .sort((p, q) => q.started_at.localeCompare(p.started_at)).slice(0, LATEST);
  $('latest').innerHTML = dayCards(latest, '<a class="day-footer" href="#log">All attempts →</a>');
  renderChart();
}

// Over the last 7 days, today on the right:
// - daily best: the longest hold of each day, with the area under it. A day without attempts keeps
//   the last day's best (a flat line), also when that day was before this week. A dot marks each
//   day she broke her all-time record.
// - average: the average of all her attempts ever, as a dashed horizontal line.
// Only before her very first attempt is there nothing to draw.
function renderChart() {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d; });
  const dayKey = d => localIso(d).slice(0, 10);
  const durationsOn = day => attempts.filter(a => a.started_at.startsWith(day)).map(a => a.duration_ms);

  // what stood before this week: the record so far, and the best of the last day with attempts
  const firstDay = dayKey(days[0]);
  const earlier = attempts.filter(a => a.started_at < firstDay);
  let record = Math.max(0, ...earlier.map(a => a.duration_ms));
  const lastBefore = earlier.reduce((day, a) => a.started_at > day ? a.started_at : day, '');
  let dayBest = lastBefore ? Math.max(...durationsOn(lastBefore.slice(0, 10))) : null;

  const bests = [], broken = [];
  for (const d of days) {
    const ms = durationsOn(dayKey(d));
    if (ms.length) dayBest = Math.max(...ms);
    broken.push(ms.length > 0 && dayBest > record);
    record = Math.max(record, dayBest ?? 0);
    bests.push(dayBest);
  }
  const avg = overallAverage();
  // the scale: up to the next even number of seconds above the best, labelled every 2 s
  const top = Math.max(2000, Math.ceil(Math.max(0, ...bests.filter(v => v !== null)) / 2000) * 2000);
  const ticks = Array.from({ length: top / 2000 }, (_, i) => (i + 1) * 2000);
  // L leaves just room for the axis labels ("8 s", later "10 s"), so the plot sits centred in the tile
  const W = 320, H = 140, L = 30, R = 8, T = 10, B = 24;
  const x = i => L + i * (W - L - R) / 6, y = v => T + (1 - v / top) * (H - T - B);

  // the daily bests as a straight line from day to day, the area under it fading out downwards
  const pts = bests.map((v, i) => v === null ? null : [x(i), y(v)]).filter(Boolean);   // nulls only lead
  let best = '';
  if (pts.length > 1) {
    const line = 'M' + pts.map(([px, py]) => `${px},${py}`).join(' L');
    best += `<linearGradient id="best-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="fill-top"/><stop offset="1" class="fill-bottom"/></linearGradient>
      <path class="area" fill="url(#best-fill)" d="${line} L${pts.at(-1)[0]},${y(0)} L${pts[0][0]},${y(0)} Z"/>
      <path class="line" d="${line}"/>`;
  }
  best += bests.map((v, i) => broken[i] ? `<circle cx="${x(i)}" cy="${y(v)}" r="3"/>` : '').join('');

  const labels = days.map((d, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${d.toLocaleDateString(undefined, { weekday: 'narrow' })}</text>`).join('');
  $('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Best hold per day over the last 7 days, and the overall average">
    <line class="axis" x1="${L}" y1="${y(0)}" x2="${W - R}" y2="${y(0)}"/>
    ${ticks.map(v => `<line class="grid" x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}"/>
      <text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v / 1000} s</text>`).join('')}
    <g class="series-record">${best}</g>
    ${avg ? `<g class="series-avg"><line class="line average" x1="${x(0)}" y1="${y(avg)}" x2="${x(6)}" y2="${y(avg)}"/></g>` : ''}
    ${labels}
  </svg>`;
}

// A tap on a tab is the moment iOS allows sound to be switched on for later
$('tabs').onclick = unlockAudio;

// ---- log: all attempts, grouped per day ----
function renderLog() {
  $('days').innerHTML = dayCards(attempts) || '<p>No attempts yet.</p>';
}

$('days').onclick = $('latest').onclick = onAttemptTap;

$('export').onclick = () => {
  const csv = ['id,started_at,duration_ms,method,flagged',
    ...attempts.map(a => [a.id, a.started_at, a.duration_ms, a.method, !!a.flagged].join(','))].join('\n');
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'handstand.csv' });
  link.click();
  URL.revokeObjectURL(link.href);
};

// ---- sound ----
let audio;
function beep(notes) {
  if (!audio) return;
  let t = audio.currentTime;
  for (const freq of notes) {
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain).connect(audio.destination);
    osc.start(t); osc.stop(t + 0.18);
    t += 0.13;
  }
}

// New-best sound: "YOO-HOO 01.wav" by sandyrb, https://freesound.org/s/86223/ (CC BY 4.0)
const cheerEl = new Audio('86223__sandyrb__yoo-hoo-01.wav');

function cheer() {
  cheerEl.currentTime = 0;
  cheerEl.play().catch(err => { console.error(err); beep([523, 659, 784, 1047]); });
}

// iOS only plays sound later if it was first started from a tap: call this from tap handlers
function unlockAudio() {
  audio ??= new AudioContext();
  audio.resume();
  cheerEl.muted = true;
  cheerEl.play().then(() => { cheerEl.pause(); cheerEl.muted = false; }).catch(console.error);
}

// ---- attempts: times are on the performance.now() clock ----
let lastId = null;   // the attempt logged last, removed again if detection resumes it

const detector = createDetector({
  onStart(ts, resumed) {
    if (resumed && lastId) { attempts = attempts.filter(a => a.id !== lastId); save(); }
    lastId = null;
    $('timer').classList.remove('record');
  },
  onEnd(startTs, endTs, flagged) {
    const duration_ms = Math.round(endTs - startTs);
    if (duration_ms >= MIN_MS) {
      const record = best() > 0 && duration_ms > best();
      lastId = Math.random().toString(36).slice(2, 8);
      attempts.unshift({
        id: lastId,
        started_at: localIso(new Date(Date.now() - (performance.now() - startTs))),
        duration_ms, method: 'auto', ...(flagged && { flagged }),
      });
      save();
      $('timer').classList.toggle('record', record);
      record ? cheer() : beep([880]);
    }
    $('timer').textContent = fmt(duration_ms);
  },
});


// ---- record screen: camera, pose model, overlay ----
let live = false, stream, landmarker, wake, frameReq;

async function loadModel() {
  const { FilesetResolver, PoseLandmarker } = await import(MP + '/vision_bundle.mjs');
  const files = await FilesetResolver.forVisionTasks(MP + '/wasm');
  return PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: NUM_POSES });
}

function onFrame(now) {
  if (!live) return;
  const v = $('video');
  const poses = landmarker.detectForVideo(v, now).landmarks;
  const lm = detector.frame(now, poses, v.videoWidth, v.videoHeight);
  draw(lm, poses);
  debug(now, lm, poses);
  frameReq = v.requestVideoFrameCallback(onFrame);
}

function draw(lm, poses) {
  const cv = $('overlay'), v = $('video'), g = cv.getContext('2d'), s = detector.state;
  if (cv.width !== v.videoWidth) { cv.width = v.videoWidth; cv.height = v.videoHeight; }
  g.clearRect(0, 0, cv.width, cv.height);
  const skeleton = (p, colour) => {
    g.strokeStyle = colour;
    g.lineWidth = 4;
    g.beginPath();
    for (const [a, b] of BONES) if (p[a].visibility > (a > 26 ? ANKLE_VIS : VIS) && p[b].visibility > (b > 26 ? ANKLE_VIS : VIS)) {
      g.moveTo(p[a].x * cv.width, p[a].y * cv.height);
      g.lineTo(p[b].x * cv.width, p[b].y * cv.height);
    }
    g.stroke();
  };
  for (const p of poses) if (p !== lm) skeleton(p, '#8b90a380');   // ignored: phantoms, bystanders
  const hint = lm && s.startTs === null ? framingHint(lm) : null;
  $('status').textContent = s.startTs !== null ? 'Up!' : !lm ? 'No one in view' : hint ?? 'Ready – kick up, side-on works best';
  if (lm) skeleton(lm, hint ? '#ffb347' : '#3ddc84');   // amber: part of her is out of frame
}

// Debug readout: landmark numbers are visibility in %, left then right; detection needs > 50 (ankles > 30)
let fps = 0, prevNow = 0;
function debug(now, lm, poses) {
  fps = fps * 0.9 + (1000 / (now - prevNow)) * 0.1;
  prevNow = now;
  const s = detector.state;
  const v = (...ids) => ids.map(i => lm ? Math.round(lm[i].visibility * 100) : '--').join(' ');
  $('debug').textContent = [
    `${fps.toFixed(0)} fps  ${(performance.now() - now).toFixed(0)} ms  poses ${poses.length}${s.locked ? ' locked' : ''}`,
    `${$('video').videoWidth}x${$('video').videoHeight}`,
    `${s.startTs === null ? 'idle' : 'up'}  inv ${s.invRun}/${s.confirm}  down ${s.downRun}/${s.confirm}`,
    `nose  ${v(0)}`, `wrist ${v(15, 16)}`, `hip   ${v(23, 24)}`, `ankle ${v(27, 28)}`,
  ].join('\n');
}

function tick() {
  if (!live) return;
  const { startTs } = detector.state;
  if (startTs !== null) $('timer').textContent = fmt(performance.now() - startTs);
  requestAnimationFrame(tick);
}

// A short message over the camera view, e.g. the name of the camera just picked
let noticeTimer;
function notice(text) {
  $('notice').textContent = text;
  $('notice').hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 2000);
}

// ---- camera: any of the device's cameras (iPhone: front, back, ultra wide = 0.5×, …), remembered here ----
let cameras = [];

async function openCamera(deviceId) {
  const get = choice => navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, ...choice } });
  if (deviceId) try { return await get({ deviceId: { exact: deviceId } }); } catch {}   // gone: use the default
  return get({ facingMode: { ideal: 'environment' } });
}

function useStream(s) {
  stream = s;
  $('video').srcObject = s;
  // the front camera is shown mirrored like a selfie; detection only compares positions, so it doesn't mind
  $('stage').classList.toggle('mirror', s.getVideoTracks()[0].getSettings().facingMode === 'user');
}

// Camera names are only available after camera permission, so the list is read once a camera is open
async function listCameras() {
  cameras = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
  $('camera').hidden = cameras.length < 2;
}

// Each tap moves to the next camera
$('camera').onclick = async () => {
  if (!live || !cameras.length) return;
  const current = stream?.getVideoTracks()[0].getSettings().deviceId;
  const i = cameras.findIndex(c => c.deviceId === current);
  const next = cameras[(i + 1) % cameras.length];
  try { localStorage.setItem(CAMERA_KEY, next.deviceId); } catch {}
  $('video').cancelVideoFrameCallback(frameReq);
  stream?.getTracks().forEach(t => t.stop());
  detector.reset();   // a different view: lock on afresh
  notice(next.label || `Camera ${(i + 1) % cameras.length + 1}`);
  try {
    const s = await openCamera(next.deviceId);
    if (!live) return s.getTracks().forEach(t => t.stop());
    useStream(s);
    await $('video').play();
    if (landmarker) frameReq = $('video').requestVideoFrameCallback(onFrame);
  } catch (err) {
    console.error(err);
    $('status').textContent = 'That camera could not start – tap for the next one';
  }
};

// ---- session: from entering the record screen until leaving it ----
async function startSession() {
  live = true;
  detector.reset();
  $('timer').textContent = '0.00';
  $('status').textContent = 'Starting camera…';
  tick();
  try { wake = await navigator.wakeLock?.request('screen'); } catch {}
  try {
    let saved = null;
    try { saved = localStorage.getItem(CAMERA_KEY); } catch {}
    const s = await openCamera(saved);
    if (!live) return s.getTracks().forEach(t => t.stop());
    useStream(s);
    await $('video').play();
    listCameras().catch(console.error);
    $('status').textContent = 'Loading pose model…';
    landmarker ??= await loadModel();
    if (live) frameReq = $('video').requestVideoFrameCallback(onFrame);
  } catch (err) {
    console.error(err);
    $('status').textContent = 'No camera or pose model';
  }
}

function endSession() {
  live = false;
  detector.reset();
  lastId = null;
  stream?.getTracks().forEach(t => t.stop());
  stream = $('video').srcObject = null;
  wake?.release();
}

renderHome();
renderLog();
route();
