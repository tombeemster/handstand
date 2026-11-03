// Tests the pure parts of the app: the session summary and the CSV format. Run: node tools/test.mjs
import assert from 'node:assert/strict';
import { sessionSummary, APP_VERSION, MISS_FIELDS } from '../summary.js';
import { MISS_REASONS, createDetector } from '../detect.js';
import { toCsv, parseCsv } from '../csv.js';

const attempt = (started_at, duration_ms, method = 'auto') => ({ id: 'a' + duration_ms, started_at, duration_ms, method });
const from = '2026-11-01T10:00:00';
const before = attempt('2026-10-30T18:00:00', 5200);
const summary = (log, extra = {}) => sessionSummary({ log, from, misses: {}, fails: 0, countManual: false, ...extra });

// An empty session sends nothing, whatever came before it
assert.equal(summary([]), null, 'empty log');
assert.equal(summary([before]), null, 'only older attempts');

// Rounding: the average in whole milliseconds
let s = summary([attempt('2026-11-01T10:01:00', 1000), attempt('2026-11-01T10:02:00', 1001), attempt('2026-11-01T10:03:00', 1001)]);
assert.equal(s.avg_ms, 1001, '1000.67 rounds up');
s = summary([attempt('2026-11-01T10:01:00', 1000), attempt('2026-11-01T10:02:00', 1000), attempt('2026-11-01T10:03:00', 1001)]);
assert.equal(s.avg_ms, 1000, '1000.33 rounds down');

// Manual attempts are counted but never enter the times, even with the setting on
const log = [attempt('2026-11-01T10:05:00', 2400), attempt('2026-11-01T10:04:00', 9000, 'manual'), attempt('2026-11-01T10:03:00', 1501), before];
for (const countManual of [false, true]) {
  s = summary(log, { misses: { 'not vertical': 2 }, fails: 1, countManual });
  assert.equal(s.attempts_total, 3);
  assert.equal(s.timed_auto, 2);
  assert.equal(s.timed_manual, 1);
  assert.equal(s.avg_ms, 1951);
  assert.equal(s.best_ms, 2400);
  assert.equal(s.record_ms, 5200, 'the record may be from an earlier day');
  assert.equal(s.manual_counted, countManual);
}

// Only manual attempts: no times from this session
s = summary([attempt('2026-11-01T10:04:00', 9000, 'manual')]);
assert.deepEqual([s.avg_ms, s.best_ms, s.record_ms], [null, null, null]);

// Misses alone are a session too
s = summary([], { misses: { 'not seen standing': 1 } });
assert.equal(s.near_misses, 1);
assert.equal(s.attempts_total, 0);

// Near misses by reason, adding up; every reason of detect.js has its count
assert.deepEqual(Object.keys(MISS_FIELDS).sort(), [...MISS_REASONS].sort());
s = summary([], { misses: { 'lock-on issue': 1, 'not steady': 2, 'not vertical': 3, 'not seen standing': 4 } });
assert.deepEqual([s.near_misses, s.miss_other_person, s.miss_unsteady, s.miss_not_vertical, s.miss_no_standing], [10, 1, 2, 3, 4]);

// Durations are capped at 10 minutes
assert.equal(summary([attempt('2026-11-01T10:01:00', 700000)]).best_ms, 600000);

// Nothing but the promised fields: no ids, no time of day
s = summary(log);
assert.deepEqual(Object.keys(s), ['day', 'attempts_total', 'timed_auto', 'timed_manual', 'near_misses',
  'miss_other_person', 'miss_unsteady', 'miss_not_vertical', 'miss_no_standing', 'fails',
  'avg_ms', 'best_ms', 'record_ms', 'manual_counted', 'app_version']);
assert.equal(s.day, '2026-11-01');
assert.equal(s.app_version, APP_VERSION);

// The screen's "seen standing": not for a pose that doesn't stand, yes once it does, gone with the lock
const pose = ys => Array.from({ length: 33 }, (_, i) => ({ x: 0.5 + (i % 2) * 0.01, y: ys[i] ?? ys.hips, visibility: 1 }));
const body = (nose, shoulder, hip, ankle) => { const ys = { hips: hip }; ys[0] = nose; ys[11] = ys[12] = shoulder; ys[15] = ys[16] = hip; ys[23] = ys[24] = hip; ys[27] = ys[28] = ankle; return pose(ys); };
const seen = createDetector({ onStart() {}, onEnd() {} });
seen.frame(0, [body(0.5, 0.5, 0.52, 0.55)], 100, 100);   // a heap on a chair
assert.equal(seen.state.seenStanding, false, 'not standing');
seen.frame(33, [body(0.2, 0.3, 0.5, 0.8)], 100, 100);
assert.equal(seen.state.seenStanding, true, 'standing');
seen.frame(3000, [], 100, 100);
seen.frame(3033, [body(0.5, 0.5, 0.52, 0.55)], 100, 100);   // gone for over 2 s, and a new lock
assert.equal(seen.state.seenStanding, false, 'lock released');
seen.frame(3066, [body(0.2, 0.3, 0.5, 0.8)], 100, 100);
seen.reset();
assert.equal(seen.state.seenStanding, false, 'reset');

// CSV: what is exported reads back the same, newest first
const flagged = { ...attempt('2026-11-01T10:06:00', 3000), flagged: true };
const back = parseCsv(toCsv([flagged, ...log]));
assert.deepEqual(back.attempts, [flagged, ...log]);
assert.equal(back.skipped, 0);
assert.deepEqual(parseCsv('﻿' + toCsv(log).replace(/\n/g, '\r\n')).attempts, log, 'BOM and Windows line ends');

// CSV: what wasn't timed goes along, in time order, comma and all; apart from the attempts when read back
const missed = [{ started_at: '2026-11-01T10:05:30', why: 'under 1s (0.80s)' }, { started_at: '2026-11-01T10:03:30', why: 'not vertical' }];
const withMissed = toCsv(log, missed);
assert.deepEqual(withMissed.split('\n').slice(1).map(l => l.split(',')[1]),
  ['2026-11-01T10:05:30', '2026-11-01T10:05:00', '2026-11-01T10:04:00', '2026-11-01T10:03:30', '2026-11-01T10:03:00', '2026-10-30T18:00:00']);
const backBoth = parseCsv(withMissed);
assert.deepEqual(backBoth.attempts, log);
assert.deepEqual(backBoth.notTimed, missed);
assert.equal(backBoth.skipped, 0);

// CSV: the reason wordings from before still read, comma and all
assert.equal(parseCsv(`${withMissed.split('\n')[0]}\n,2026-01-01T10:00:00,,not_timed,false,"timed 0.80 s, under 1 s"`).notTimed[0].why, 'timed 0.80 s, under 1 s');

// CSV: a file from before this column still reads
const oldFile = 'id,started_at,duration_ms,method,flagged\nabc,2026-01-01T10:00:00,1500,manual,true\n';
assert.deepEqual(parseCsv(oldFile), { attempts: [{ id: 'abc', started_at: '2026-01-01T10:00:00', duration_ms: 1500, method: 'manual', flagged: true }], notTimed: [], skipped: 0 });

// CSV: a reason is checked as well: it ends up in the page
assert.equal(parseCsv(`${withMissed.split('\n')[0]}\n,2026-01-01T10:00:00,,not_timed,false,"<img src=x>"`).skipped, 1);

// CSV: refused, or skipped row by row; nothing unchecked reaches the page
assert.equal(parseCsv('a,b\n1,2'), null, 'not an export');
const dirty = parseCsv('id,started_at,duration_ms,method,flagged\n<img>,2026-01-01T10:00:00,1000,auto,false\nabc,2026-01-01T10:00:00,-5,auto,false\nabc,<b>,1000,auto,false\nabc,2026-01-01T10:00:00,1000,hack,false\nabc,2026-01-01T10:00:00,1500,manual,false\n');
assert.equal(dirty.skipped, 4);
assert.equal(dirty.attempts.length, 1);

console.log('ok');
