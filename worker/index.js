// The one door between the app and the database: takes an anonymous session summary (built by
// ../summary.js), checks it and stores it. The app never talks to Supabase itself.
// Logs nothing, on purpose: no IP, no headers, no body. Don't add console.log here (privacy page).
// Deploy and secrets: README.md in this folder.

const ORIGIN = 'https://tombeemster.github.io';   // the live app; other browsers' pages are refused
const MAX_BODY = 1024;                            // bytes: a summary is about 250
const MAX_COUNT = 500;                            // attempts or misses in one session
const MAX_MS = 600000;                            // 10 minutes, as summary.js caps them
const DAY_MS = 86400000;

const MISSES = ['miss_other_person', 'miss_unsteady', 'miss_not_vertical', 'miss_no_standing'];
const COUNTS = ['attempts_total', 'timed_auto', 'timed_manual', 'near_misses', ...MISSES, 'fails'];
const TIMES = ['avg_ms', 'best_ms', 'record_ms'];
const FIELDS = ['day', ...COUNTS, ...TIMES, 'manual_counted', 'app_version'];

const count = v => Number.isInteger(v) && v >= 0 && v <= MAX_COUNT;
const time = v => v === null || (Number.isInteger(v) && v > 0 && v <= MAX_MS);

// Near today only (a day either side, for time zones): summaries are sent when a session ends
function recentDay(day, now) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const ms = Date.parse(day + 'T00:00:00Z');
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === day && Math.abs(ms - now) <= 2 * DAY_MS;
}

// Exactly the fields of the privacy page, each of the right type and in range, and adding up
export function valid(s, now = Date.now()) {
  if (s === null || typeof s !== 'object' || Array.isArray(s)) return false;
  const keys = Object.keys(s);
  return keys.length === FIELDS.length && FIELDS.every(f => keys.includes(f))
    && recentDay(s.day, now)
    && COUNTS.every(f => count(s[f]))
    && TIMES.every(f => time(s[f]))
    && typeof s.manual_counted === 'boolean'
    && typeof s.app_version === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s.app_version)
    && s.attempts_total === s.timed_auto + s.timed_manual
    && s.near_misses === MISSES.reduce((sum, f) => sum + s[f], 0)
    && (s.timed_auto > 0 ? s.avg_ms !== null && s.best_ms !== null && s.record_ms !== null
      && s.avg_ms <= s.best_ms && s.best_ms <= s.record_ms : s.avg_ms === null && s.best_ms === null);
}

const reply = status => new Response(null, { status, headers: { 'Access-Control-Allow-Origin': ORIGIN } });

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return reply(405);
    if (request.headers.get('Origin') !== ORIGIN) return reply(403);
    const text = await request.text();
    if (text.length > MAX_BODY) return reply(400);
    let summary;
    try { summary = JSON.parse(text); } catch { return reply(400); }
    if (!valid(summary)) return reply(400);
    // A new-style key (sb_secret_…) goes in apikey alone; an older service_role key in both
    const auth = env.SUPABASE_KEY.startsWith('sb_') ? {} : { Authorization: `Bearer ${env.SUPABASE_KEY}` };
    const stored = await fetch(`${env.SUPABASE_URL}/rest/v1/session_summaries`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_KEY, ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(summary),
    }).catch(() => null);
    return reply(stored?.ok ? 204 : 502);
  },
};
