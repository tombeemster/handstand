// The numbers behind home's chart, its Average best tile and the Daily records list. Pure: no page, no clock,
// no storage, so it can be tested in Node.
//
// Why not the average of every attempt: every try starts as a kick-up, and about half of them end within
// 2 s, so that mean sits far below her level and barely moves while she improves (measured on 1,681
// attempts over 22 days: 2.3 s against a record of 12.7 s, and between 1.3 and 2.9 s every single day).
// The average of her best holds does follow her progress, and matches the chart, which plots those.

// How many practice days the chart shows at a time, the Daily records list lists, and the average covers
export const RECENT_DAYS = 5;

// highs: the longest counted hold of each practice day in ms, oldest first (days she didn't practise are not
// in it: the chart has no empty days). Returns the average best on each practice day: the mean of its hold and
// the 4 before it (fewer at the start).
export function averageBest(highs, window = RECENT_DAYS) {
  return highs.map((_, i) => {
    const recent = highs.slice(Math.max(0, i - window + 1), i + 1);
    return recent.reduce((sum, ms) => sum + ms, 0) / recent.length;
  });
}