import { createDetector, framingHint, VIS, ANKLE_VIS, MIN_MS, MERGE_MS } from './detect.js';

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
// NUM_POSES 2 was tried: the model then reports one body twice (upright and flipped), worse.
const NUM_POSES = 1;
const BONES = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
const KEY = 'handstand.attempts', CAMERA_KEY = 'handstand.camera';

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
  if (!$('day').hidden) renderDay(shownDay);
}

// When an attempt started, day first: 18/10/2026 – 07:16:09
const stamp = a => `${a.started_at.slice(8, 10)}/${a.started_at.slice(5, 7)}/${a.started_at.slice(0, 4)} – ${a.started_at.slice(11)}`;

// A day as its card title: "Friday 23 October", in the browser's language
const dayLabel = day => new Date(day + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

// One attempt as a list row: its date and time, its duration; cls: 'best' (a record), 'top' or ''
const row = (a, cls) => `<li class="${cls}" data-id="${a.id}">
  <time>${stamp(a)}</time><strong>${fmt(a.duration_ms)}s</strong>
</li>`;

// The log: one card per day, newest day first, each with that day's 3 longest attempts and an arrow to
// the day's own page with all of them. Attempts that set a record at the time are marked "best".
const LOG_TOP = 3;
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';   // Lucide arrow-right
function dayCards(list) {
  const records = recordIds(), byDay = new Map();
  for (const a of list) {
    const day = a.started_at.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), a]);
  }
  return [...byDay].map(([day, items]) => `
    <div class="day">
      <div class="day-label card-header">${dayLabel(day)}<a href="#log/${day}" aria-label="All attempts of ${dayLabel(day)}">${ARROW}</a></div>
      <ul>${[...items].sort((p, q) => q.duration_ms - p.duration_ms).slice(0, LOG_TOP).map(a => row(a, records.has(a.id) ? 'best' : '')).join('')}</ul>
    </div>`).join('');
}

// A day's own page: all its attempts in time order. Records at their time are marked "best" (gold);
// the day's longest, if it isn't one of those, "top" (outlined).
let shownDay = null;
function renderDay(day) {
  shownDay = day;
  const records = recordIds();
  const items = attempts.filter(a => a.started_at.startsWith(day)).sort((p, q) => p.started_at.localeCompare(q.started_at));
  const top = items.reduce((b, a) => !b || a.duration_ms > b.duration_ms ? a : b, null);
  $('day-title').textContent = dayLabel(day);
  $('day-list').innerHTML = items.map(a => row(a, records.has(a.id) ? 'best' : a === top ? 'top' : '')).join('')
    || '<li>No attempts on this day.</li>';
}

// Tapping an attempt in the log or on a day's page offers to delete it (false starts, mis-timed holds)
function onAttemptTap(e) {
  const li = e.target.closest('li[data-id]');
  const a = li && attempts.find(a => a.id === li.dataset.id);
  if (a && confirm(`Delete the attempt of ${stamp(a)} (${fmt(a.duration_ms)}s)?`)) {
    attempts = attempts.filter(x => x.id !== a.id);
    save();
  }
}

// ---- screens: #home (or none), #record, #log, one tab each. The camera is on only on #record. ----
// #log/2026-10-23 is one day's page: part of the log, so the log tab stays highlighted there
const SCREENS = ['home', 'record', 'log', 'day'];

function route() {
  const [name, day] = location.hash.slice(1).split('/');
  const screen = name === 'log' && day ? 'day' : SCREENS.includes(name) ? name : 'home';
  for (const s of SCREENS) $(s).hidden = s !== screen;
  if (screen === 'day') renderDay(day);
  const tab = screen === 'day' ? 'log' : screen;
  for (const a of $('tabs').querySelectorAll('a')) {
    if (a.hash === '#' + tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
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
  const week = lastWeek();
  renderChart(week);
  // the chart's days as a list, today on top: each day's own best, or a dash if she didn't practise
  $('highs').innerHTML = [...week].reverse().map(d => `<li class="${d.record ? 'best' : ''}">
    <time>${d.date.toLocaleDateString(undefined, { weekday: 'long' })}${d.at ? ` - ${d.at}` : ''}</time><strong>${d.record ? '<span class="record-dot series-record"></span>' : ''}${d.own ? fmt(d.own) + 's' : '–'}</strong>
  </li>`).join('');
}

// The last 7 days, oldest first, as the chart and the Daily high list show them:
// - own: that day's longest hold, or null if she didn't practise; at: when it started (hh:mm)
// - high: what the chart draws, the last practice day's best carried over days without attempts (also
//   from before this week); null only before her very first attempt
// - record: the day her current all-time record was set (at most one day; none if it's older)
function lastWeek() {
  const dayKey = d => localIso(d).slice(0, 10);
  const durationsOn = day => attempts.filter(a => a.started_at.startsWith(day)).map(a => a.duration_ms);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d; });

  // the attempt that holds the all-time record (the first one, if two are equal)
  const holder = attempts.reduce((b, a) => !b || a.duration_ms > b.duration_ms
    || (a.duration_ms === b.duration_ms && a.started_at < b.started_at) ? a : b, null);
  const recordDay = holder?.started_at.slice(0, 10);

  // the best of the last day with attempts before this week, carried into its first days
  const earlier = attempts.filter(a => a.started_at < dayKey(days[0]));
  const lastBefore = earlier.reduce((day, a) => a.started_at > day ? a.started_at : day, '');
  let high = lastBefore ? Math.max(...durationsOn(lastBefore.slice(0, 10))) : null;

  return days.map(date => {
    const top = attempts.filter(a => a.started_at.startsWith(dayKey(date)))
      .reduce((b, a) => !b || a.duration_ms > b.duration_ms ? a : b, null);
    const own = top?.duration_ms ?? null, at = top?.started_at.slice(11, 16) ?? null;
    if (own) high = own;
    return { date, own, at, high, record: dayKey(date) === recordDay };
  });
}

// The chart, over lastWeek(), today on the right, in the colours of the home tiles:
// - daily high: a line through each day's high, with the area under it. One dot in the record colour
//   marks the day her current record was set, where the line meets the record line. (Days without
//   attempts after it carry that value, so the line can run along the record line until she practises
//   again: kept on purpose over ending the line at the last practice day.)
// - average of all her attempts ever (the Average tile) and the all-time record: dashed horizontal lines.
//   (A line through each day's average was tried: it barely moves, the overall value says as much.)
function renderChart(week) {
  const days = week.map(d => d.date), bests = week.map(d => d.high), recordAt = week.map(d => d.record);
  const avg = overallAverage(), allTime = best();
  // the scale: gridlines and labels at an even number of whole seconds apart, at most 8 of them,
  // the top one at or just above the best (6.7 s: 2, 4, 6, 8 · 72 s: 10, 20, … 80)
  const highest = Math.max(1, allTime, ...bests.filter(v => v !== null));
  const step = [2, 4, 10, 20, 30, 60, 120, 300, 600].map(s => s * 1000).find(s => highest <= s * 8) ?? Math.ceil(highest / 8 / 60000) * 60000;
  const top = Math.ceil(highest / step) * step;
  const ticks = Array.from({ length: top / step }, (_, i) => (i + 1) * step);
  // L leaves just room for the axis labels ("8 s", later "10 s"), so the plot sits centred in the tile
  const W = 320, H = 140, L = 30, R = 8, T = 10, B = 24;
  const x = i => L + i * (W - L - R) / 6, y = v => T + (1 - v / top) * (H - T - B);

  // the daily bests as a straight line from day to day, the area under it fading out downwards
  const pts = bests.map((v, i) => v === null ? null : [x(i), y(v)]).filter(Boolean);   // nulls only lead
  let dailyLine = '';
  if (pts.length > 1) {
    const line = 'M' + pts.map(([px, py]) => `${px},${py}`).join(' L');
    dailyLine += `<linearGradient id="best-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="fill-top"/><stop offset="1" class="fill-bottom"/></linearGradient>
      <path class="area" fill="url(#best-fill)" d="${line} L${pts.at(-1)[0]},${y(0)} L${pts[0][0]},${y(0)} Z"/>
      <path class="line" d="${line}"/>`;
  }
  const dots = bests.map((v, i) => recordAt[i] ? `<circle cx="${x(i)}" cy="${y(v)}" r="3.75"/>` : '').join('');   // 7.5 units across, about 7.5 px
  const level = (value, cls) => value ? `<g class="${cls}"><line class="line dashed" x1="${x(0)}" y1="${y(value)}" x2="${x(6)}" y2="${y(value)}"/></g>` : '';

  const labels = days.map((d, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${d.toLocaleDateString(undefined, { weekday: 'narrow' })}</text>`).join('');
  $('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Best hold per day over the last 7 days, the all-time record and the overall average">
    <line class="axis" x1="${L}" y1="${y(0)}" x2="${W - R}" y2="${y(0)}"/>
    ${ticks.map(v => `<line class="grid" x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}"/>
      <text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v / 1000} s</text>`).join('')}
    <g class="series-best">${dailyLine}</g>
    ${level(avg, 'series-avg')}${level(allTime, 'series-record')}
    <g class="series-record">${dots}</g>
    ${labels}
  </svg>`;
}

// A tap on a tab is the moment iOS allows sound to be switched on for later
$('tabs').onclick = unlockAudio;

// ---- log: all attempts, grouped per day ----
function renderLog() {
  $('days').innerHTML = dayCards(attempts) || '<p>No attempts yet.</p>';
}

$('days').onclick = $('day-list').onclick = onAttemptTap;

$('export').onclick = () => {
  const csv = ['id,started_at,duration_ms,method,flagged',
    ...attempts.map(a => [a.id, a.started_at, a.duration_ms, a.method, !!a.flagged].join(','))].join('\n');
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'handstand.csv' });
  link.click();
  URL.revokeObjectURL(link.href);
};

// ---- sound ----
let audio;   // the Web Audio engine, started by the first tap (unlockAudio)

// Level-up chimes: every file in sounds/ whose name starts with a number of seconds ("04s-…") is the
// chime for a hold longer than that; the longest level reached plays when the timer stops. Adding,
// removing or renaming a file is all it takes. Credits in README.md.
// A page can't list a folder itself, so the server does: GitHub's file list for the repo on the live
// site, the folder listing of `npx serve` locally. Both answer in JSON, as [{ name }] or { files: [{ base }] }.
async function soundFiles() {
  const [owner] = location.hostname.split('.'), [, repo] = location.pathname.split('/');
  const url = location.hostname.endsWith('.github.io') ? `https://api.github.com/repos/${owner}/${repo}/contents/sounds` : 'sounds/';
  const list = await (await fetch(url, { headers: { Accept: 'application/json' } })).json();
  return (list.files ?? list).map(f => f.name ?? f.base).filter(name => /^\d+s.*\.(wav|mp3|m4a|ogg)$/i.test(name));
}

// The chimes, decoded once into the Web Audio engine, as [seconds, sound] from short to long. (Not
// <audio> elements: unlocking those on iPhone meant playing one muted on every tap, and that let a
// sound go off at random.) A file that won't load or decode is skipped: the level below it plays.
let chimes = null, playing = null;
function loadChimes() {
  audio ??= new AudioContext();
  return chimes ??= soundFiles()
    .then(files => Promise.all(files.map(name => fetch('sounds/' + encodeURIComponent(name))
      .then(r => r.arrayBuffer()).then(b => audio.decodeAudioData(b))
      .then(sound => [parseInt(name), sound], err => console.error(name, err)))))
    .then(list => list.filter(Boolean).sort((p, q) => p[0] - q[0]))
    .catch(err => { console.error(err); return []; });   // no list (offline?): no chimes, the time is still spoken
}

// Plays the chime for a hold of ms, then calls done (straight away if the hold earns none)
async function chime(ms, done) {
  const sound = (await loadChimes()).findLast(([seconds]) => ms > seconds * 1000)?.[1];
  if (!sound) return done();
  let finished = false;
  const finish = () => { if (!finished) { finished = true; playing = null; done(); } };
  playing = audio.createBufferSource();
  playing.buffer = sound;
  playing.connect(audio.destination);
  playing.onended = finish;
  playing.start();
  setTimeout(finish, sound.duration * 1000 + 300);   // also when the engine is paused and never says "ended"
}

// For the debug box: is sound on, is the sound engine running, which voice would speak
function soundState() {
  if (muted) return 'sound off';
  if (!('speechSynthesis' in window)) return `no speech · audio ${audio?.state ?? 'not started'}`;
  const voices = speechSynthesis.getVoices(), dutch = voices.filter(v => v.lang.replace('_', '-').startsWith('nl'));
  const voice = dutch.find(v => FEMALE_DUTCH.test(v.name)) ?? dutch[0];
  return `audio ${audio?.state ?? 'not started'} · ${voices.length} voices · ${voice ? voice.name : 'no Dutch voice'}`;
}

// The time spoken in Dutch, a little faster than normal, by one of the device's own voices: a female
// one if there is one. Voices don't say whether they're female, so these are the female Dutch voices
// by name (iPhone: Claire, Ellen; Windows: Colette, Fenna; Chrome: Google Nederlands); otherwise any
// Dutch voice.
const FEMALE_DUTCH = /claire|ellen|colette|fenna|google nederlands/i;
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const dutch = speechSynthesis.getVoices().filter(v => v.lang.replace('_', '-').startsWith('nl'));
  const say = new SpeechSynthesisUtterance(text);
  say.lang = 'nl-NL';
  say.voice = dutch.find(v => FEMALE_DUTCH.test(v.name)) ?? dutch[0] ?? null;
  say.rate = 1.2;
  speechSynthesis.speak(say);
}
// "4 punt 8", "13": one decimal, said as "punt"
const spokenTime = ms => (ms / 1000).toFixed(1).replace(/\.0$/, '').replace('.', ' punt ');

// Sound on/off (the speaker button on the record screen), remembered on this device
const MUTE_KEY = 'handstand.muted';
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch {}
$('mute').setAttribute('aria-pressed', String(muted));
$('mute').onclick = () => {
  unlockAudio();   // a tap: the moment iOS allows sound, e.g. after reloading straight onto this screen
  muted = !muted;
  $('mute').setAttribute('aria-pressed', String(muted));
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch {}
  if (muted) {   // also silence whatever is playing right now
    try { playing?.stop(); } catch {}
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  } else {
    speak('Geluid aan');   // straight from the tap: also a quick check that speech works on this device
  }
  notice(muted ? 'Sound off' : 'Sound on');
};

// iOS only plays sound later if it was first started from a tap: call this from tap handlers
function unlockAudio() {
  audio ??= new AudioContext();
  audio.resume();
  if ('speechSynthesis' in window) {   // speech, too; and start loading the voices, which some browsers do lazily
    speechSynthesis.getVoices();
    // iOS may skip an empty sentence without unlocking speech: say a space, silently
    const silent = new SpeechSynthesisUtterance(' ');
    silent.volume = 0;
    speechSynthesis.speak(silent);
  }
}

// ---- attempts: times are on the performance.now() clock ----
let lastId = null;   // the attempt logged last, removed again if detection resumes it
let announcing;      // the pending announcement of the attempt that just ended
let manualStart = null;   // a tapped attempt in progress (performance.now() at the first tap)

// An attempt has ended, detected or tapped: log it if it lasted 1 s or more, then play its level chime
// and say the time. wait: hold the announcement back this long (a detected attempt may still resume).
// Returns the duration.
function endAttempt(startTs, endTs, method, flagged = false, wait = 0) {
  const duration_ms = Math.round(endTs - startTs);
  if (duration_ms < MIN_MS) return duration_ms;
  const record = best() > 0 && duration_ms > best();
  const id = Math.random().toString(36).slice(2, 8);
  lastId = method === 'auto' ? id : null;   // only a detected attempt can be resumed by detection
  attempts.unshift({
    id,
    started_at: localIso(new Date(Date.now() - (performance.now() - startTs))),
    duration_ms, method, ...(flagged && { flagged }),
  });
  save();
  $('timer').classList.toggle('record', record);
  announcing = setTimeout(() => muted || chime(duration_ms,
    () => speak(record ? `Nieuw record! ${spokenTime(duration_ms)}` : spokenTime(duration_ms))), wait);
  return duration_ms;
}

const detector = createDetector({
  onStart(ts, resumed) {
    if (manualStart !== null) return;   // timing by tap: detection doesn't interfere
    if (resumed) clearTimeout(announcing);   // it hadn't really ended: say nothing
    if (resumed && lastId) { attempts = attempts.filter(a => a.id !== lastId); save(); }
    lastId = null;
    $('timer').classList.remove('record');
  },
  onEnd(startTs, endTs, flagged) {
    if (manualStart !== null) return;
    // announced once the attempt can no longer resume (see MERGE_MS), so a short loss of
    // tracking isn't announced as a landing
    $('timer').textContent = fmt(endAttempt(startTs, endTs, 'auto', flagged, MERGE_MS));
  },
});

// Tapping the timer starts it, tapping again stops it: manual timing, for testing the sounds and for
// when detection misses a handstand. Detection is ignored meanwhile, and tapping does nothing while a
// detected attempt runs. Afterwards the timer is back at 0.00.
$('timer').onclick = () => {
  unlockAudio();   // a tap: the moment iOS allows sound
  if (detector.state.startTs !== null) return;
  if (manualStart === null) {
    manualStart = performance.now();
    $('timer').classList.remove('record');
    return;
  }
  endAttempt(manualStart, performance.now(), 'manual');
  manualStart = null;
  $('timer').textContent = '0.00';
};


// ---- record screen: camera, pose model, overlay ----
let live = false, stream, landmarker, wake, frameReq;
let lastFrame = -1;   // time of the last frame analysed

async function loadModel() {
  const { FilesetResolver, PoseLandmarker } = await import(MP + '/vision_bundle.mjs');
  const files = await FilesetResolver.forVisionTasks(MP + '/wasm');
  return PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: NUM_POSES });
}

// The pose model is loaded once and shared by every visit to this screen. Leaving while it still
// loads and coming back used to start a second load next to the first, which can hang.
let modelLoading = null;
function getModel() {
  return modelLoading ??= loadModel().catch(err => { modelLoading = null; throw err; });
}

// The model failed on a frame: show why (also on the phone, in the debug box), then start a fresh
// model and carry on with it
function restartModel(err) {
  console.error(err);
  $('debug').textContent = `pose model error:
${err?.message ?? err}`;
  $('status').textContent = 'Restarting pose model…';
  try { landmarker.close(); } catch {}
  landmarker = modelLoading = null;
  getModel()
    .then(model => { landmarker = model; if (live) frameReq = $('video').requestVideoFrameCallback(onFrame); })
    .catch(e => { console.error(e); $('status').textContent = 'No pose model – reload the page'; });
}

function onFrame(now) {
  // The pose model only takes frames in strictly increasing time. Two loops would hand it the same
  // frame twice, which breaks it for good (the view froze after leaving and re-entering this screen),
  // so a frame that isn't newer ends that loop here.
  if (!live || now <= lastFrame) return;
  lastFrame = now;
  const v = $('video');
  let poses;
  try { poses = landmarker.detectForVideo(v, now).landmarks; }
  catch (err) { return restartModel(err); }
  const lm = detector.frame(now, poses, v.videoWidth, v.videoHeight);
  draw(lm, poses, now);
  debug(now, lm, poses);
  frameReq = v.requestVideoFrameCallback(onFrame);
}

// The athlete's skeleton is drawn calmly. Positions go through a One Euro filter: strong smoothing
// while a joint is nearly still (no wobble), little while it moves fast (no lag in a kick-up).
// Visibility is averaged over a few frames so limbs don't blink. Display only: detection uses the raw pose.
const SMOOTH = { minCutoff: 1.5, beta: 5, dCutoff: 1, visibility: 0.2 };
let shown = null, shownTs = 0;   // the smoothed pose last drawn, and when

function smoothPose(lm, ts) {
  if (!lm) return null;
  const dt = (ts - shownTs) / 1000;
  shownTs = ts;
  if (!shown || dt <= 0 || dt > 0.3) {   // first sight, or lost for a while: start from where she is
    shown = lm.map(p => ({ x: p.x, y: p.y, visibility: p.visibility, dx: 0, dy: 0 }));
    return shown;
  }
  const alpha = cutoff => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
  shown = shown.map((q, i) => {
    const p = lm[i];
    const dx = q.dx + alpha(SMOOTH.dCutoff) * ((p.x - q.x) / dt - q.dx);
    const dy = q.dy + alpha(SMOOTH.dCutoff) * ((p.y - q.y) / dt - q.dy);
    const k = alpha(SMOOTH.minCutoff + SMOOTH.beta * Math.hypot(dx, dy));
    return { x: q.x + k * (p.x - q.x), y: q.y + k * (p.y - q.y), dx, dy,
             visibility: q.visibility + SMOOTH.visibility * (p.visibility - q.visibility) };
  });
  return shown;
}

function draw(lm, poses, ts) {
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
  const calm = smoothPose(lm, ts);
  if (calm) skeleton(calm, hint ? '#ffb347' : '#3ddc84');   // amber: part of her is out of frame
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
    soundState(),
  ].join('\n');
}

function tick() {
  if (!live) return;
  const startTs = manualStart ?? detector.state.startTs;
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

// ---- camera: back or front, and on the back 1× or 0.5× (the ultra wide lens), remembered here ----
let camera = { facing: 'environment', zoom: 1 };
try { camera = { ...camera, ...JSON.parse(localStorage.getItem(CAMERA_KEY)) }; } catch {}
let ultraWide = null;   // device id of the back ultra wide lens, the iPhone's "0.5×"

async function openCamera() {
  const get = pick => navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, ...pick } });
  if (camera.facing === 'environment' && camera.zoom === 0.5 && ultraWide) {
    try { return await get({ deviceId: { exact: ultraWide } }); } catch {}   // gone: the normal back camera
  }
  // "exact": a facing mode given as a preference is often ignored when a camera is already in use,
  // and the flip button then got the same camera back. Only cameras that report no direction at
  // all (PC webcams) fall back to the preference.
  try { return await get({ facingMode: { exact: camera.facing } }); }
  catch { return get({ facingMode: { ideal: camera.facing } }); }
}

// Stop the current camera and start the one `camera` asks for
async function reopenCamera() {
  stream?.getTracks().forEach(t => t.stop());
  const s = await openCamera();
  if (!live) return s.getTracks().forEach(t => t.stop());
  useStream(s);
  await $('video').play();
}

function useStream(s) {
  stream = s;
  $('video').srcObject = s;
  // the front camera is shown mirrored like a selfie; detection only compares positions, so it doesn't mind
  $('stage').classList.toggle('mirror', s.getVideoTracks()[0].getSettings().facingMode === 'user');
}

// Camera names are only available after camera permission, so this runs once a camera is open.
// The ultra wide lens is found by name: "Back Ultra Wide Camera", and in the other languages we
// know of the name contains "ultra" too (Dutch "ultragroothoek"). Without one, there's no 0.5×.
async function findCameras() {
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
  ultraWide = cams.find(c => /ultra/i.test(c.label))?.deviceId ?? null;
  $('flip').hidden = cams.length < 2;
  showZoom();
}

const wantsUltraWide = () => camera.facing === 'environment' && camera.zoom === 0.5 && ultraWide;

function showZoom() {
  $('zoom').hidden = camera.facing === 'user' || !ultraWide;
  for (const b of $('zoom').querySelectorAll('button')) b.setAttribute('aria-pressed', String(Number(b.dataset.zoom) === camera.zoom));
}

// A tap on flip or a lens: a different view, so tracking starts afresh
async function switchCamera() {
  try { localStorage.setItem(CAMERA_KEY, JSON.stringify(camera)); } catch {}
  showZoom();
  if (!live) return;
  $('video').cancelVideoFrameCallback(frameReq);
  detector.reset();
  shown = null;
  try {
    await reopenCamera();
    if (live && landmarker) frameReq = $('video').requestVideoFrameCallback(onFrame);
  } catch (err) {
    console.error(err);
    $('status').textContent = 'That camera could not start';
  }
}

$('flip').onclick = () => {
  camera.facing = camera.facing === 'user' ? 'environment' : 'user';
  notice(camera.facing === 'user' ? 'Front camera' : 'Back camera');
  switchCamera();
};

$('zoom').onclick = e => {
  const zoom = Number(e.target.dataset.zoom);
  if (zoom && zoom !== camera.zoom) { camera.zoom = zoom; switchCamera(); }
};

// ---- session: from entering the record screen until leaving it ----
async function startSession() {
  live = true;
  manualStart = null;
  detector.reset();
  shown = null;
  $('timer').textContent = '0.00';
  $('status').textContent = 'Starting camera…';
  tick();
  try { wake = await navigator.wakeLock?.request('screen'); } catch {}
  try {
    const s = await openCamera();
    if (!live) return s.getTracks().forEach(t => t.stop());
    useStream(s);
    await $('video').play();
    await findCameras().catch(console.error);
    loadChimes();   // in the background, ready by the first landing
    // the ultra wide lens can only be found once a camera is open: switch to it now if it was chosen
    if (wantsUltraWide() && stream.getVideoTracks()[0].getSettings().deviceId !== ultraWide) await reopenCamera();
    if (!live) return;
    $('status').textContent = 'Loading pose model…';
    landmarker = await getModel();
    if (live) frameReq = $('video').requestVideoFrameCallback(onFrame);
  } catch (err) {
    console.error(err);
    $('status').textContent = 'No camera or pose model';
  }
}

function endSession() {
  live = false;
  manualStart = null;
  $('video').cancelVideoFrameCallback(frameReq);   // or the pending request runs as a second loop next session
  detector.reset();
  lastId = null;
  stream?.getTracks().forEach(t => t.stop());
  stream = $('video').srcObject = null;
  wake?.release();
}

renderHome();
renderLog();
route();
