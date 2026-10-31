// One session's anonymous summary: what the analytics switch sends (once the Worker is there) and what
// "What gets sent" shows. Pure: no page, no clock, no storage, so it can be tested in Node.
// No ids of any kind, no times of day: a summary can't be linked to a person, a phone or another summary.

export const APP_VERSION = '1.0.0';
const MAX_MS = 600000;   // 10 minutes: no duration sent is longer (the Worker checks the same)

// log: every attempt (newest first, as stored); from: the session's start as local ISO time
// (attempts started since then are this session's); misses, fails: its near misses and attempts under
// 1 s; countManual: the manual timing setting. Returns null for a session with nothing in it.
// Times are of automatic attempts only, whatever the setting: a tapped time can be anything.
export function sessionSummary({ log, from, misses, fails, countManual }) {
  const mine = log.filter(a => a.started_at >= from);
  if (!mine.length && !misses && !fails) return null;
  const auto = mine.filter(a => a.method === 'auto').map(a => Math.min(a.duration_ms, MAX_MS));
  const allAuto = log.filter(a => a.method === 'auto').map(a => Math.min(a.duration_ms, MAX_MS));
  return {
    day: from.slice(0, 10),
    attempts_total: mine.length,
    timed_auto: auto.length,
    timed_manual: mine.length - auto.length,
    near_misses: misses,
    fails,
    avg_ms: auto.length ? Math.round(auto.reduce((s, ms) => s + ms, 0) / auto.length) : null,
    best_ms: auto.length ? Math.max(...auto) : null,
    record_ms: allAuto.length ? Math.max(...allAuto) : null,
    manual_counted: countManual,
    app_version: APP_VERSION,
  };
}
