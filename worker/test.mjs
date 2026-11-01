// Tests the Worker without any network or account: Supabase is replaced by a stand-in.
// Run: node worker/test.mjs
import assert from 'node:assert/strict';
import worker, { valid } from './index.js';
import { sessionSummary } from '../summary.js';

const ORIGIN = 'https://tombeemster.github.io';
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'sb_secret_test' };
const today = new Date().toISOString().slice(0, 10);

// What the app really builds is what the Worker must accept
const log = [
  { started_at: `${today}T10:05:00`, duration_ms: 2400, method: 'auto' },
  { started_at: `${today}T10:04:00`, duration_ms: 9000, method: 'manual' },
  { started_at: `${today}T10:03:00`, duration_ms: 1501, method: 'auto' },
  { started_at: '2026-01-01T18:00:00', duration_ms: 5200, method: 'auto' },
];
const good = sessionSummary({ log, from: `${today}T10:00:00`, misses: 2, fails: 1, countManual: false });

let sent = [];
let supabaseOk = true;
globalThis.fetch = async (url, init) => { sent.push({ url, init }); return { ok: supabaseOk }; };

const post = (body, origin = ORIGIN, method = 'POST') => worker.fetch(new Request('https://worker.test/', {
  method, headers: origin ? { Origin: origin } : {}, ...(method === 'POST' && { body: typeof body === 'string' ? body : JSON.stringify(body) }),
}), env);

const cases = [
  ['a real summary is stored', good, 204],
  ['an extra field', { ...good, name: 'Someone' }, 400],
  ['a session id', { ...good, id: 'abc' }, 400],
  ['a missing field', (({ fails, ...rest }) => rest)(good), 400],
  ['a wrong type', { ...good, near_misses: '2' }, 400],
  ['a count out of range', { ...good, fails: 501 }, 400],
  ['a negative count', { ...good, fails: -1 }, 400],
  ['a time out of range', { ...good, record_ms: 600001 }, 400],
  ['totals that do not add up', { ...good, attempts_total: 99 }, 400],
  ['a best above the record', { ...good, best_ms: good.record_ms + 1 }, 400],
  ['an old day', { ...good, day: '2020-01-01' }, 400],
  ['a day that does not exist', { ...good, day: '2026-02-31' }, 400],
  ['a bad version', { ...good, app_version: 'latest' }, 400],
  ['not JSON', 'hello', 400],
  ['an array', [good], 400],
  ['too long', ' '.repeat(2000) + JSON.stringify(good), 400],
];
for (const [name, body, status] of cases) {
  sent = [];
  const res = await post(body);
  assert.equal(res.status, status, name);
  assert.equal(sent.length, status === 204 ? 1 : 0, name + ': stored only when valid');
}

// A session with only misses: no times at all, still valid
const onlyMisses = sessionSummary({ log, from: `${today}T23:59:59`, misses: 3, fails: 0, countManual: true });
assert.equal(onlyMisses.avg_ms, null);
assert.equal(valid(onlyMisses), true, 'misses only');

// Only POST, only from the app
assert.equal((await post(good, 'https://evil.example')).status, 403, 'another origin');
assert.equal((await post(good, null)).status, 403, 'no origin');
assert.equal((await post(null, ORIGIN, 'GET')).status, 405, 'GET');

// What goes to Supabase: the summary and nothing else, a new-style key in apikey only
sent = [];
await post(good);
assert.equal(sent[0].url, 'https://example.supabase.co/rest/v1/session_summaries');
assert.deepEqual(JSON.parse(sent[0].init.body), good);
assert.equal(sent[0].init.headers.apikey, env.SUPABASE_KEY);
assert.equal(sent[0].init.headers.Authorization, undefined);

// Supabase down: says so, doesn't pretend
supabaseOk = false;
assert.equal((await post(good)).status, 502, 'Supabase failing');

console.log(`ok: ${cases.length + 6} checks passed`);
