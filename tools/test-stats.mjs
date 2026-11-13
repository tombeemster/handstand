// Tests for stats.js. Run: node tools/test-stats.mjs  (fold into tools/test.mjs when convenient)
import assert from 'node:assert/strict';
import { averageBest, RECENT_DAYS } from '../stats.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

ok('the chart, the list and the average all use 5 practice days', () => assert.equal(RECENT_DAYS, 5));

ok('no practice days: nothing', () => assert.deepEqual(averageBest([]), []));

ok('the first practice day: its own hold', () => assert.deepEqual(averageBest([4000]), [4000]));

ok('before there are 5 practice days: the mean of the ones there are', () => {
  const out = averageBest([4000, 6000, 8000]);
  assert.deepEqual(out, [4000, 5000, 6000]);
});

ok('from the 5th practice day on: the mean of the last 5', () => {
  const out = averageBest([2000, 4000, 6000, 8000, 10000, 12000]);
  close(out[4], 6000);    // 2, 4, 6, 8, 10
  close(out[5], 8000);    // 4, 6, 8, 10, 12: the first has left
});

ok('a better day lifts it, a weaker one pulls it down', () => {
  const out = averageBest([4000, 12000, 2000]);
  close(out[1], 8000);
  close(out[2], 6000);
});

ok('another window can be asked for', () => assert.deepEqual(averageBest([2000, 4000, 6000], 2), [2000, 3000, 5000]));

console.log(`${n} passed`);
