import { createDetector, framingHint, VIS, ANKLE_VIS, MIN_MS, MERGE_MS, MERGE_LATE_MS } from './detect.js';

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const BONES = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
const KEY = 'handstand.attempts', CAMERA_KEY = 'handstand.camera';

const $ = id => document.getElementById(id);
// The log and settings, kept on this device as JSON. Never throws: in a private window, or with a
// corrupt value, recall gives the fallback and remember does nothing.
const recall = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const remember = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const fmt = ms => (ms / 1000).toFixed(2);
// Local time as ISO 8601 without a zone, e.g. 2026-10-11T18:04:12
const localIso = d => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);

// ---- log (newest first) ----
let attempts = recall(KEY, []);
const best = () => Math.max(0, ...attempts.map(a => a.duration_ms));
// The attempts that set a new all-time record when they happened (ids), and the one that holds it now
// (current: the last of them, so the first of two equal holds), or null before any attempt
function records() {
  const ids = new Set();
  let current = null;
  for (const a of [...attempts].sort((p, q) => p.started_at.localeCompare(q.started_at))) {
    if (a.duration_ms > (current?.duration_ms ?? 0)) { current = a; ids.add(a.id); }
  }
  return { ids, current };
}
// The average of every attempt ever: shown in the average tile and as the chart's dashed line
const overallAverage = () => attempts.length ? attempts.reduce((s, a) => s + a.duration_ms, 0) / attempts.length : null;

// Saving redraws only the screen on view; the others are drawn when you go to them (see route).
// Redrawing every screen on every landing cost a stutter while the camera ran, more as the log grows.
function save() {
  remember(KEY, attempts);
  render();
}

// When an attempt started, day first: 18/10/2026 – 07:16:09
const stamp = a => `${a.started_at.slice(8, 10)}/${a.started_at.slice(5, 7)}/${a.started_at.slice(0, 4)} – ${a.started_at.slice(11)}`;

// A day as its tile title: "Friday 23 October", in the browser's language
const dayLabel = day => new Date(day + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

// The current record's mark in every list, the same dot as in the chart
const DOT = '<span class="record-dot series-record"></span>';

// One attempt as a list row: its date and time, its duration; cls: 'best' (a record), 'top' or ''.
// rec: records(), for the dot on the current record; end: more inside the row (a day's Delete button).
const row = (a, cls, rec, end = '') => `<li class="${cls}" data-id="${a.id}">
  <time>${stamp(a)}</time><strong>${a === rec.current ? DOT : ''}${fmt(a.duration_ms)}s</strong>${end}
</li>`;

// The log: one tile per day, newest day first, each with that day's 3 longest attempts and an arrow to
// the day's own page with all of them. Attempts that set a record at the time are marked "best".
// (A grid of small day tiles, two per row with month headings, was tried and dropped: less readable.)
const LOG_TOP = 3;
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';   // Lucide arrow-right
const longestFirst = items => [...items].sort((p, q) => q.duration_ms - p.duration_ms);

function renderLog() {
  $('delete-all').hidden = !attempts.length;
  const rec = records(), byDay = new Map();
  for (const a of attempts) {
    const day = a.started_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(a);
  }
  $('days').innerHTML = [...byDay].sort(([p], [q]) => q.localeCompare(p)).map(([day, items]) => `
    <div class="day">
      <div class="day-label tile-header">${dayLabel(day)}<a href="#log/${day}" aria-label="All attempts of ${dayLabel(day)}">${ARROW}</a></div>
      <ul>${longestFirst(items).slice(0, LOG_TOP).map(a => row(a, rec.ids.has(a.id) ? 'best' : '', rec)).join('')}</ul>
    </div>`).join('')
    // before her first attempt: today's tile, empty, with no arrow to a day page
    || `<div class="day">
      <div class="day-label tile-header">${dayLabel(localIso(new Date()).slice(0, 10))}</div>
      <ul><li>No attempts yet.</li></ul>
    </div>`;
}

// A day's own page: all its attempts, longest first. Records at their time are marked "best" (gold);
// the day's longest (the first), if it isn't one of those, "top" (outlined).
function renderDay(day) {
  const rec = records();
  const items = longestFirst(attempts.filter(a => a.started_at.startsWith(day)));
  $('day-title').textContent = dayLabel(day);
  $('day-list').innerHTML = items.map((a, i) => row(a, rec.ids.has(a.id) ? 'best' : i === 0 ? 'top' : '', rec, DELETE)).join('')
    || '<li>No attempts on this day.</li>';
  $('clear-day').hidden = !items.length;
}

// The button under a day's page: deletes all that day's attempts, then back to the log
$('clear-day').onclick = () => {
  const n = attempts.filter(a => a.started_at.startsWith(day)).length;
  if (!confirm(`Delete all ${n} attempt${n === 1 ? '' : 's'} of ${dayLabel(day)}?`)) return;
  attempts = attempts.filter(a => !a.started_at.startsWith(day));
  save();
  location.hash = '#log';
};

// On a day's page, swiping a row left shows its Delete button; tapping that deletes the attempt (false
// starts, mis-timed holds). A long swipe, past half the row, deletes it at once. One row is open at a
// time; a tap elsewhere in the list closes it. The log's day tiles don't delete: the day's page is the one place.
const DELETE = '<button class="row-delete">Delete</button>';
const OPEN = 80;   // px: how far an open row is slid, the Delete button's width (style.css)
let swipe = null, opened = null;   // the drag under way; the row left open
const slide = (li, dx) => li.style.setProperty('--dx', dx + 'px');
function closeRow() {
  if (opened) slide(opened, 0);
  opened = null;
}

$('day-list').onpointerdown = e => {
  const li = e.target.closest('li[data-id]');
  if (!li || e.target.closest('.row-delete')) return;
  const wasOpen = li === opened;
  if (!wasOpen) closeRow();
  swipe = { li, x: e.clientX, y: e.clientY, from: wasOpen ? -OPEN : 0, dx: null, width: li.offsetWidth };   // dx: null until it moves sideways
};
$('day-list').onpointermove = e => {
  if (!swipe) return;
  const mx = e.clientX - swipe.x, my = e.clientY - swipe.y;
  if (swipe.dx === null) {
    if (Math.abs(my) > 8 && Math.abs(my) > Math.abs(mx)) { swipe = null; return; }   // scrolling the page
    if (Math.abs(mx) < 8) return;
    swipe.li.classList.add('dragging');   // follows the finger, no easing
    swipe.li.setPointerCapture(e.pointerId);
  }
  swipe.dx = Math.min(0, Math.max(-swipe.width, swipe.from + mx));
  slide(swipe.li, swipe.dx);
};
$('day-list').onpointerup = $('day-list').onpointercancel = () => {
  if (!swipe) return;
  const { li, dx, width } = swipe;
  swipe = null;
  if (dx === null) return closeRow();   // a tap
  li.classList.remove('dragging');
  if (dx <= -width / 2) {   // a long swipe: slides all the way out, then it's gone
    slide(li, -width);
    opened = null;
    return setTimeout(() => deleteAttempt(li.dataset.id), 200);   // the slide's duration (style.css)
  }
  opened = dx < -OPEN / 2 ? li : null;   // past half the button: snaps open, else back
  slide(li, opened ? -OPEN : 0);
};
$('day-list').onclick = e => {
  const id = e.target.closest('.row-delete')?.closest('li').dataset.id;
  if (!id) return;
  opened = null;
  deleteAttempt(id);
};
function deleteAttempt(id) {
  attempts = attempts.filter(a => a.id !== id);
  save();
}

// ---- screens: #home (or none), #record, #log, one tab each. The camera is on only on #record. ----
// #log/2026-10-23 is one day's page: part of the log, so the log tab stays highlighted there
const SCREENS = ['home', 'record', 'log', 'day'];
let screen = 'home', day = null;   // on view now

// Draws the screen on view (the record screen draws itself, frame by frame)
function render() {
  if (screen === 'home') renderHome();
  if (screen === 'log') renderLog();
  if (screen === 'day') renderDay(day);
}

function route() {
  const [name, date] = location.hash.slice(1).split('/');
  screen = name === 'log' && date ? 'day' : SCREENS.includes(name) ? name : 'home';
  day = date ?? null;
  for (const s of SCREENS) $(s).hidden = s !== screen;
  render();
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
  // before her first attempt: only the "Record now" tile (style.css hides the rest)
  $('home').classList.toggle('empty', !attempts.length);
  if (!attempts.length) return;
  const pb = best();
  $('best').textContent = pb ? fmt(pb) + ' s' : '–';
  const avg = overallAverage();
  $('average').textContent = avg ? fmt(avg) + ' s' : '–';
  const days = chartDays();
  renderChart(days);
  // the chart's last 7 days as a list, today on top: each day's own best, or a dash if she didn't practise
  $('highs').innerHTML = days.slice(-7).reverse().map(d => `<li class="${d.record ? 'best' : ''}">
    <time>${d.date.toLocaleDateString(undefined, { weekday: 'long' })}${d.at ? ` - ${d.at}` : ''}</time><strong>${d.record ? DOT : ''}${d.own ? fmt(d.own) + 's' : '–'}</strong>
  </li>`).join('');
}

// Every day from her first attempt's to today (at least the last 7), oldest first, as the chart and
// the Daily highs list (its last 7) show them:
// - own: that day's longest hold, or null if she didn't practise; at: when it started (hh:mm)
// - high: what the chart draws, the last practice day's best carried over days without attempts;
//   null only before her very first attempt
// - record: the day her current all-time record was set (at most one day)
function chartDays() {
  const dayKey = d => localIso(d).slice(0, 10);
  const tops = new Map();   // each day's longest attempt (the first of equals)
  for (const a of attempts) {
    const day = a.started_at.slice(0, 10);
    if (!(tops.get(day)?.duration_ms >= a.duration_ms)) tops.set(day, a);
  }
  const first = attempts.reduce((t, a) => a.started_at < t ? a.started_at : t, dayKey(new Date()));
  const count = Math.max(7, Math.round((new Date(dayKey(new Date()) + 'T12:00') - new Date(first.slice(0, 10) + 'T12:00')) / 864e5) + 1);
  const days = Array.from({ length: count }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (count - 1) + i); return d; });

  const recordDay = records().current?.started_at.slice(0, 10);
  let high = null;
  return days.map(date => {
    const top = tops.get(dayKey(date));
    const own = top?.duration_ms ?? null, at = top?.started_at.slice(11, 16) ?? null;
    if (own) high = own;
    return { date, own, at, high, record: dayKey(date) === recordDay };
  });
}

// The chart, over chartDays(), in the colours of the home tiles. It shows 7 days at a time, today on
// the right; swipe right for the weeks before. The seconds labels stay put on the left.
// - daily high: a line through each day's high, with the area under it. One dot in the record colour
//   marks the day her current record was set, where the line meets the record line. (Days without
//   attempts after it carry that value, so the line can run along the record line until she practises
//   again: kept on purpose over ending the line at the last practice day.)
// - average of all her attempts ever (the Average tile) and the all-time record: dashed horizontal lines.
//   (A line through each day's average was tried: it barely moves, the overall value says as much.)
function renderChart(chart) {
  const days = chart.map(d => d.date), bests = chart.map(d => d.high), recordAt = chart.map(d => d.record);
  const avg = overallAverage(), allTime = best();
  // the scale: gridlines and labels at an even number of whole seconds apart, at most 8 of them,
  // the top one at or just above the best (6.7 s: 2, 4, 6, 8 · 72 s: 10, 20, … 80)
  const highest = Math.max(1, allTime, ...bests.filter(v => v !== null));
  const step = [2, 4, 10, 20, 30, 60, 120, 300, 600].map(s => s * 1000).find(s => highest <= s * 8) ?? Math.ceil(highest / 8 / 60000) * 60000;
  const top = Math.ceil(highest / step) * step;
  const ticks = Array.from({ length: top / step }, (_, i) => (i + 1) * step);
  // Two drawings at one scale: the seconds labels, L wide (just room for "8 s", later "10 s"), and
  // beside them the plot, 7 days to the visible W - L and as many more as there are days, scrolled.
  // style.css gives the labels the same L / W of the tile's width, so the units match.
  const W = 320, H = 140, L = 30, T = 10, B = 24;
  const dayW = (W - L) / 7, plotW = days.length * dayW;
  const x = i => (i + 0.5) * dayW, y = v => T + (1 - v / top) * (H - T - B);

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
  // class level: what a tap on the matching home tile lights up (see the tiles' onclick)
  const level = (value, cls) => value ? `<g class="${cls} level"><line class="line dashed" x1="0" y1="${y(value)}" x2="${plotW}" y2="${y(value)}"/></g>` : '';

  const labels = days.map((d, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${d.toLocaleDateString(undefined, { weekday: 'narrow' })}</text>`).join('');
  $('chart').innerHTML = `<svg class="seconds" viewBox="0 0 ${L} ${H}" aria-hidden="true">
    ${ticks.map(v => `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v / 1000} s</text>`).join('')}
  </svg>
  <div class="scroller"><svg viewBox="0 0 ${plotW} ${H}" style="width: ${days.length / 7 * 100}%" role="img" aria-label="Best hold per day, the all-time record and the overall average">
    <line class="axis" x1="0" y1="${y(0)}" x2="${plotW}" y2="${y(0)}"/>
    ${ticks.map(v => `<line class="grid" x1="0" y1="${y(v)}" x2="${plotW}" y2="${y(v)}"/>`).join('')}
    <g class="series-best">${dailyLine}</g>
    ${level(avg, 'series-avg')}${level(allTime, 'series-record')}
    <g class="series-record">${dots}</g>
    ${labels}
  </svg></div>`;
  const scroller = $('chart').querySelector('.scroller');
  scroller.scrollLeft = scroller.scrollWidth;   // start at today
}

// A tap on the Record or Average tile lights up its line in the chart, to show which is which
$('tiles').onclick = e => {
  const g = $('chart').querySelector(`.level.${e.target.closest('[data-line]')?.dataset.line}`);
  if (!g) return;
  g.classList.remove('flash');
  g.getBoundingClientRect();   // restarts the animation on a second tap
  g.classList.add('flash');
};

// A tap on a tab is the moment iOS allows sound to be switched on for later
$('tabs').onclick = unlockAudio;

$('export').onclick = () => {
  const csv = ['id,started_at,duration_ms,method,flagged',
    ...attempts.map(a => [a.id, a.started_at, a.duration_ms, a.method, !!a.flagged].join(','))].join('\n');
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'handstand.csv' });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);   // straight away, Safari may not have the file yet
};

// Under the export: empties the whole log, after asking (export first to keep a copy)
$('delete-all').onclick = () => {
  if (!confirm(`Delete all ${attempts.length} attempts? This can't be undone.`)) return;
  attempts = [];
  save();
};

// ---- sound ----
let audio;   // the Web Audio engine, started by the first tap (unlockAudio)

// Level-up chimes: every file in sounds/ whose name starts with a number of seconds ("04s-…") is the
// chime for a hold longer than that; the longest level reached plays when the timer stops. Several files
// with the same number are variants of one level: a random one plays, never the same one twice in a row.
// Files starting with "error" are the not-timed sound (see noteMiss), picked the same way.
// Adding, removing or renaming a file is all it takes. Credits in README.md.
// A page can't list a folder itself, so the server does: GitHub's file list for the repo on the live
// site, the folder listing of `npx serve` locally. Both answer in JSON, as [{ name }] or { files: [{ base }] } (where name lacks the extension).
async function soundFiles() {
  const [owner] = location.hostname.split('.'), [, repo] = location.pathname.split('/');
  const url = location.hostname.endsWith('.github.io') ? `https://api.github.com/repos/${owner}/${repo}/contents/sounds` : 'sounds/';
  const list = await (await fetch(url, { headers: { Accept: 'application/json' } })).json();
  return (list.files ?? list).map(f => f.base ?? f.name).filter(name => /^(\d+s|error).*\.(wav|mp3|m4a)$/i.test(name));
}

// The sounds, decoded once into the Web Audio engine: chimes as [seconds, sounds] from short to long,
// and the error sounds. (Not <audio> elements: unlocking those on iPhone meant playing one muted on every
// tap, and that let a sound go off at random.) A file that won't load or decode is skipped; a level
// without any plays the one below.
let sounds = null, playing = null, lastSound = null;
function loadSounds() {
  audio ??= new AudioContext();
  return sounds ??= soundFiles()
    .then(files => Promise.all(files.map(name => fetch('sounds/' + encodeURIComponent(name))
      .then(r => r.arrayBuffer()).then(b => audio.decodeAudioData(b))
      .then(sound => [name, sound], err => console.error(name, err)))))
    .then(list => {
      const levels = new Map(), errors = [];
      for (const [name, sound] of list.filter(Boolean)) {
        if (/^error/i.test(name)) errors.push(sound);
        else levels.set(parseInt(name), [...(levels.get(parseInt(name)) ?? []), sound]);
      }
      return { chimes: [...levels].sort((p, q) => p[0] - q[0]), errors };
    })
    .catch(err => { console.error(err); return { chimes: [], errors: [] }; });   // no list (offline?): no sounds, the time is still spoken
}

// Plays the chime for a hold of ms, then calls done (straight away if the hold earns none)
async function chime(ms, done) {
  const choices = (await loadSounds()).chimes.findLast(([seconds]) => ms > seconds * 1000)?.[1];
  if (!choices) return done();
  play(choices, done);
}

// The not-timed sound (see noteMiss), unless muted
async function errorSound() {
  const { errors } = await loadSounds();
  if (!muted && errors.length) play(errors);
}

// Plays one of choices, at random but not the one played last, then calls done
function play(choices, done = () => {}) {
  const fresh = choices.length > 1 ? choices.filter(s => s !== lastSound) : choices;
  const sound = lastSound = fresh[Math.floor(Math.random() * fresh.length)];
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
  return `audio ${audio?.state ?? 'not started'} · ${dutchVoice()?.name ?? 'no Dutch voice'}`;
}

// The time spoken in Dutch, a little faster than normal, by one of the device's own voices: a female
// one if there is one. Voices don't say whether they're female, so these are the female Dutch voices
// by name (iPhone: Claire, Ellen; Windows: Colette, Fenna; Chrome: Google Nederlands); otherwise any
// Dutch voice.
const FEMALE_DUTCH = /claire|ellen|colette|fenna|google nederlands/i;
// Found once: the voice list is long, and some browsers fill it in only after a while (until then: none)
let voice = null;
function dutchVoice() {
  if (!voice) {
    const dutch = speechSynthesis.getVoices().filter(v => v.lang.replace('_', '-').startsWith('nl'));
    voice = dutch.find(v => FEMALE_DUTCH.test(v.name)) ?? dutch[0] ?? null;
  }
  return voice;
}
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const say = new SpeechSynthesisUtterance(text);
  say.lang = 'nl-NL';
  say.voice = dutchVoice();
  say.rate = 1.2;
  speechSynthesis.speak(say);
}
// "4 punt 8", "13": one decimal, said as "punt"
const spokenTime = ms => (ms / 1000).toFixed(1).replace(/\.0$/, '').replace('.', ' punt ');

// The debug box (the scan button, top right of the record screen), on or off, remembered on this device
const DEBUG_KEY = 'handstand.debug';
function showDebug(on) {
  $('debug').hidden = !on;
  $('debug-toggle').setAttribute('aria-pressed', String(on));
  remember(DEBUG_KEY, on);
}
showDebug(!!recall(DEBUG_KEY, false));   // !!: stored as 1 or 0 before
$('debug-toggle').onclick = () => showDebug($('debug').hidden);

// Sound on/off (the speaker button on the record screen), remembered on this device
const MUTE_KEY = 'handstand.muted';
let muted = !!recall(MUTE_KEY, false);   // !!: stored as 1 or 0 before
$('mute').setAttribute('aria-pressed', String(muted));
$('mute').onclick = () => {
  unlockAudio();   // a tap: the moment iOS allows sound, e.g. after reloading straight onto this screen
  muted = !muted;
  $('mute').setAttribute('aria-pressed', String(muted));
  remember(MUTE_KEY, muted);
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
  const pb = best(), record = pb > 0 && duration_ms > pb;
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

// Near misses this session, newest first: she was upside down but no attempt was timed, and why.
// Shown in the debug box. (Attempts under 1 s are noted here too.) Each one is also heard and seen at
// once, the error sound and "Not timed", so she can go again straight away. Held back MERGE_MS: an
// attempt starting by then means it wasn't a miss after all (see onStart).
// (Flagging more, "seen standing, then lost" or "shoulders below the hips", was measured on all the
// recordings: lost fired after nearly every landing, 31 times; the shoulders cue caught nothing the
// near misses didn't already, at 30 fps or at 15. Every attempt the 15 fps replay lost was a near miss.)
const misses = [];
let missing;   // the pending sound and notice of the latest miss
function noteMiss(ts, why) {
  misses.unshift({ at: new Date(Date.now() - (performance.now() - ts)).toTimeString().slice(0, 8), why });
  console.info('near miss', misses[0]);
  clearTimeout(missing);
  missing = setTimeout(() => { notice('Not timed – go again'); errorSound(); }, MERGE_MS);
}

const detector = createDetector({
  onStart(ts, resumed) {
    if (manualStart !== null) return;   // timing by tap: detection doesn't interfere
    clearTimeout(missing);   // a miss just before was the start of this one
    if (resumed) clearTimeout(announcing);   // it hadn't really ended: say nothing
    if (resumed && lastId) { attempts = attempts.filter(a => a.id !== lastId); save(); }
    lastId = null;
    $('timer').classList.remove('record');
  },
  onEnd(startTs, endTs, flagged) {
    if (manualStart !== null) return;
    // announced once the attempt can no longer resume (see MERGE_LATE_MS), so a short loss of
    // tracking isn't announced as a landing
    const ms = endAttempt(startTs, endTs, 'auto', flagged, MERGE_LATE_MS);
    if (ms < MIN_MS) noteMiss(startTs, `timed ${fmt(ms)} s, under 1 s`);
    $('timer').textContent = fmt(ms);
  },
  onMiss(ts, why) {
    if (manualStart === null) noteMiss(ts, why);
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
  return PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 1 });   // 2 was tried: it then reports one body twice (upright and flipped)
}

// Each model ('main', and 'flip' for the second opinion) is loaded once and shared by every visit to
// this screen. Leaving while one still loaded and coming back used to start a second load, which can hang.
const loading = {};
function getModel(name = 'main') {
  return loading[name] ??= loadModel().catch(err => { delete loading[name]; throw err; });
}

// The upside-down second opinion (see frame() in detect.js): the same model on the camera frame turned
// 180°, run only on the frames where it can matter. Its own copy of the model, since each one follows
// what it saw in earlier frames. Optional: if it fails to load or errors, the app carries on without it.
let flipModel = null;
const flipCanvas = document.createElement('canvas');
// Asked for by the detector only when the normal reading has her standing with her arms up
function flippedPoses(v, now) {
  if (!flipModel) return [];
  try {
    if (flipCanvas.width !== v.videoWidth) { flipCanvas.width = v.videoWidth; flipCanvas.height = v.videoHeight; }
    const g = flipCanvas.getContext('2d');
    g.setTransform(-1, 0, 0, -1, flipCanvas.width, flipCanvas.height);   // turned 180°
    g.drawImage(v, 0, 0);
    // turned back: the same picture positions as the normal reading
    return flipModel.detectForVideo(flipCanvas, now).landmarks.map(pose => pose.map(p => ({ ...p, x: 1 - p.x, y: 1 - p.y })));
  } catch (err) {
    console.error(err);
    flipModel = null;   // without the second opinion from here on
    return [];
  }
}

// The model failed on a frame: show why (also on the phone, in the debug box), then start a fresh
// model and carry on with it
function restartModel(err) {
  console.error(err);
  $('debug').textContent = `pose model error:
${err?.message ?? err}`;
  $('status').textContent = 'Restarting pose model…';
  try { landmarker.close(); } catch {}
  landmarker = null;
  delete loading.main;
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
  const lm = detector.frame(now, poses, v.videoWidth, v.videoHeight, () => flippedPoses(v, now));
  pace(now);
  draw(lm, poses);
  debug(now, lm, poses);
  frameReq = v.requestVideoFrameCallback(onFrame);
}

// The skeletons as the model sees them, this frame. (A One Euro filter smoothed her skeleton for a
// calmer look; dropped as not worth its code. Detection always used the raw pose.)
// The skeleton's colours: the style.css tokens, read on the first frame (the styles have loaded by then)
let skin = null;
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
  skin ??= Object.fromEntries(['--dim', '--wait', '--ready'].map(t => [t, getComputedStyle(document.documentElement).getPropertyValue(t).trim()]));
  g.globalAlpha = 0.5;   // ignored poses (phantoms, bystanders): faint
  for (const p of poses) if (p !== lm) skeleton(p, skin['--dim']);
  g.globalAlpha = 1;
  const hint = lm && s.startTs === null ? framingHint(lm) : null;
  const warn = s.startTs === null && slow;
  const status = s.startTs !== null ? 'Up!' : warn ? slowWarning() : !lm ? 'No one in view' : hint ?? 'Ready – kick up, side-on works best';
  // only when it changes (the icon has no text, so textContent is the message alone)
  if ($('status').textContent !== status) $('status').innerHTML = (warn ? ALERT : '') + status;
  if (lm) skeleton(lm, hint ? skin['--wait'] : skin['--ready']);   // amber: part of her is out of frame
}

// Frame rate check. The bake-off on all recorded clips timed 59 of 60 attempts at 30 fps, but only 44
// at 15 fps: with too few frames the model loses her in the fast kick-up. So below MIN_FPS the status
// warns, and says why: the camera sends too few frames (usually too dark: it keeps its shutter open
// longer), or the device can't analyse them fast enough (busy: ms per frame). Cleared above FPS_OK, so
// it doesn't flicker; checked only after the first WARM_MS, while the camera and model settle.
// (20 is a judgement between the two measured rates: 30 fps was fine, 15 fps was not.)
const MIN_FPS = 20, FPS_OK = 24, WARM_MS = 3000;
let fps = 0, busy = 0, prevNow = 0, paceFrom = null, slow = false;
function pace(now) {
  paceFrom ??= now;
  const gap = now - prevNow;
  prevNow = now;
  if (gap > 0 && gap < 1000) fps = fps * 0.95 + (1000 / gap) * 0.05;   // a longer gap: a camera switch
  busy = busy * 0.9 + (performance.now() - now) * 0.1;
  if (now - paceFrom > WARM_MS) slow = fps < (slow ? FPS_OK : MIN_FPS);
}
const ALERT = '<svg class="alert" viewBox="0 0 24 24" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';   // Lucide triangle-alert
const slowWarning = () => busy > 0.8 * 1000 / fps
  ? `Only ${fps.toFixed(0)} fps – this device is too slow, attempts may be missed`
  : `Only ${fps.toFixed(0)} fps – add light, or attempts may be missed`;
// A new camera or session: measure afresh
function resetPace() {
  fps = busy = prevNow = 0;
  paceFrom = null;
  slow = false;
}

// Debug readout: landmark numbers are visibility in %, left then right; detection needs > 50 (ankles > 30).
// Written four times a second: every frame was work for nothing, and frames are what detection needs.
// The last lines are the session's latest near misses (see noteMiss), newest first.
let debugAt = 0;
function debug(now, lm, poses) {
  if ($('debug').hidden || now - debugAt < 250) return;   // hidden: no work at all
  debugAt = now;
  const s = detector.state;
  const v = (...ids) => ids.map(i => lm ? Math.round(lm[i].visibility * 100) : '--').join(' ');
  $('debug').textContent = [
    `${fps.toFixed(0)} fps  ${busy.toFixed(0)} ms  poses ${poses.length}${s.locked ? ' locked' : ''}`,
    `${$('video').videoWidth}x${$('video').videoHeight}`,
    `${s.startTs === null ? 'idle' : 'up'}  inv ${s.invRun}/${s.confirm}  down ${s.downRun}/${s.confirm}`,
    `nose  ${v(0)}`, `wrist ${v(15, 16)}`, `hip   ${v(23, 24)}`, `ankle ${v(27, 28)}`,
    soundState(),
    ...misses.slice(0, 3).map(m => `missed ${m.at}: ${m.why}`),
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
camera = { ...camera, ...recall(CAMERA_KEY, {}) };
let ultraWide = null;   // device id of the back ultra wide lens, the iPhone's "0.5×"

async function openCamera() {
  const get = pick => navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, ...pick } });
  // (Asking for frameRate: { ideal: 30 } as well was tried: on the phone more handstands went untimed
  // that day. Not proven to be the cause, but undone; see the low frame rate warning instead.)
  if (camera.facing === 'environment' && camera.zoom === 0.5 && ultraWide) {
    try { return await get({ deviceId: { exact: ultraWide } }); } catch {}   // gone: the normal back camera
  }
  // "exact": a facing mode given as a preference is often ignored when a camera is already in use,
  // and the flip button then got the same camera back. Only cameras that report no direction at
  // all (PC webcams) fall back to the preference.
  try { return await get({ facingMode: { exact: camera.facing } }); }
  catch { return get({ facingMode: { ideal: camera.facing } }); }
}

// Stop the current camera, if any, and start the one `camera` asks for
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
  remember(CAMERA_KEY, camera);
  showZoom();
  if (!live) return;
  $('video').cancelVideoFrameCallback(frameReq);
  detector.reset();
  resetPace();
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
  resetPace();
  $('timer').textContent = '0.00';
  $('status').textContent = 'Starting camera…';
  tick();
  try { wake = await navigator.wakeLock?.request('screen'); } catch {}
  try {
    await reopenCamera();
    if (!live) return;
    await findCameras().catch(console.error);
    loadSounds();   // in the background, ready by the first landing
    // the ultra wide lens can only be found once a camera is open: switch to it now if it was chosen
    if (wantsUltraWide() && stream.getVideoTracks()[0].getSettings().deviceId !== ultraWide) await reopenCamera();
    if (!live) return;
    $('status').textContent = 'Loading pose model…';
    landmarker = await getModel();
    getModel('flip').then(m => { flipModel = m; }).catch(console.error);   // the second opinion, when ready
    if (live) frameReq = $('video').requestVideoFrameCallback(onFrame);
  } catch (err) {
    console.error(err);
    $('status').textContent = 'No camera or pose model';
  }
}

function endSession() {
  // An attempt still running is dropped, not logged. (Logging it, ended now, was tried: a detection
  // still "up" by mistake then became a count that never happened.)
  live = false;
  manualStart = null;
  $('video').cancelVideoFrameCallback(frameReq);   // or the pending request runs as a second loop next session
  detector.reset();
  lastId = null;
  stream?.getTracks().forEach(t => t.stop());
  stream = $('video').srcObject = null;
  wake?.release();
}

route();
