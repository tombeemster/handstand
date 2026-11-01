// Tests the pure parts of the app: the session summary and the CSV format. Run: node tools/test.mjs
import assert from 'node:assert/strict';
import { sessionSummary, APP_VERSION, MISS_FIELDS } from '../summary.js';
import { MISS_REASONS } from '../detect.js';
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
  s = summary(log, { misses: { 'body not vertical': 2 }, fails: 1, countManual });
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
s = summary([], { misses: { 'not seen standing first': 1 } });
assert.equal(s.near_misses, 1);
assert.equal(s.attempts_total, 0);

// Near misses by reason, adding up; every reason of detect.js has its count
assert.deepEqual(Object.keys(MISS_FIELDS).sort(), [...MISS_REASONS].sort());
s = summary([], { misses: { 'lock on someone else': 1, 'not steady 3 frames in a row': 2, 'body not vertical': 3, 'not seen standing first': 4 } });
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

// CSV: what is exported reads back the same, newest first
const flagged = { ...attempt('2026-11-01T10:06:00', 3000), flagged: true };
const back = parseCsv(toCsv([flagged, ...log]));
assert.deepEqual(back.attempts, [flagged, ...log]);
assert.equal(back.skipped, 0);
assert.deepEqual(parseCsv('﻿' + toCsv(log).replace(/\n/g, '\r\n')).attempts, log, 'BOM and Windows line ends');

// CSV: refused, or skipped row by row; nothing unchecked reaches the page
assert.equal(parseCsv('a,b\n1,2'), null, 'not an export');
const dirty = parseCsv('id,started_at,duration_ms,method,flagged\n<img>,2026-01-01T10:00:00,1000,auto,false\nabc,2026-01-01T10:00:00,-5,auto,false\nabc,<b>,1000,auto,false\nabc,2026-01-01T10:00:00,1000,hack,false\nabc,2026-01-01T10:00:00,1500,manual,false\n');
assert.equal(dirty.skipped, 4);
assert.equal(dirty.attempts.length, 1);

console.log('ok');
