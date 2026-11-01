// The log as a CSV file: what Export writes and Import reads, so the two can't drift apart.
// Pure: no page, no storage, so it can be tested in Node.
// A row is an attempt, or something the app saw but didn't time: method not_timed, no id or duration, and
// a reason (in quotes: it can hold a comma). Newest first. Files from before there were such rows, without
// the reason column, still read.

const OLD_HEADER = 'id,started_at,duration_ms,method,flagged';
const HEADER = OLD_HEADER + ',reason';
const MAX_MS = 24 * 3600 * 1000;   // no real attempt is longer: a row above this is a damaged one

export function toCsv(attempts, notTimed = []) {
  const rows = [
    ...attempts.map(a => ({ at: a.started_at, text: [a.id, a.started_at, a.duration_ms, a.method, !!a.flagged, ''].join(',') })),
    ...notTimed.map(f => ({ at: f.started_at, text: `,${f.started_at},,not_timed,false,"${f.why}"` })),
  ].sort((p, q) => q.at.localeCompare(p.at));
  return [HEADER, ...rows.map(r => r.text)].join('\n');
}

const validTime = at => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(at);

// What's in an exported file, newest first as the app keeps it, and how many rows didn't read. Every field
// is checked: the values end up in the page. Null if it isn't an export at all.
export function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(line => line.trim());
  const header = lines[0]?.trim();
  if (header !== HEADER && header !== OLD_HEADER) return null;
  const attempts = [], notTimed = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const [id, started_at, duration, method, flagged, ...rest] = line.trim().split(',');
    const why = rest.join(',').replace(/^"|"$/g, '');
    const duration_ms = Number(duration);
    if (method === 'not_timed' && validTime(started_at) && /^[a-z0-9 .,]{1,60}$/i.test(why)) {
      notTimed.push({ started_at, why });
    } else if (/^[a-z0-9]{1,20}$/i.test(id) && validTime(started_at)
      && Number.isInteger(duration_ms) && duration_ms > 0 && duration_ms <= MAX_MS
      && (method === 'auto' || method === 'manual')) {
      attempts.push({ id, started_at, duration_ms, method, ...(flagged === 'true' && { flagged: true }) });
    } else skipped++;
  }
  const newestFirst = (p, q) => q.started_at.localeCompare(p.started_at);
  return { attempts: attempts.sort(newestFirst), notTimed: notTimed.sort(newestFirst), skipped };
}
