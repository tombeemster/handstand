// The log as a CSV file: what Export writes and Import reads, so the two can't drift apart.
// Pure: no page, no storage, so it can be tested in Node.

const HEADER = 'id,started_at,duration_ms,method,flagged';
const MAX_MS = 24 * 3600 * 1000;   // no real attempt is longer: a row above this is a damaged one

export const toCsv = attempts => [HEADER,
  ...attempts.map(a => [a.id, a.started_at, a.duration_ms, a.method, !!a.flagged].join(','))].join('\n');

// The attempts in an exported file, newest first as the app keeps them, and how many rows didn't read
// as an attempt. Every field is checked: the values end up in the page. Null if it isn't an export at all.
export function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines[0]?.trim() !== HEADER) return null;
  const attempts = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const [id, started_at, duration, method, flagged] = line.trim().split(',');
    const duration_ms = Number(duration);
    if (/^[a-z0-9]{1,20}$/i.test(id) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(started_at)
      && Number.isInteger(duration_ms) && duration_ms > 0 && duration_ms <= MAX_MS
      && (method === 'auto' || method === 'manual')) {
      attempts.push({ id, started_at, duration_ms, method, ...(flagged === 'true' && { flagged: true }) });
    } else skipped++;
  }
  attempts.sort((p, q) => q.started_at.localeCompare(p.started_at));
  return { attempts, skipped };
}
