// Runs one video's cached poses (made by replay.py) through the app's own detect.js and prints the
// attempts and near misses as JSON. The rules exist only in detect.js: nothing here decides anything.
// Usage: node tools/replay.mjs <poses.json> <flipped-poses.json>
import { readFileSync } from 'node:fs';
import { createDetector, MIN_MS } from '../detect.js';

const [normal, flipped] = process.argv.slice(2).map(file => JSON.parse(readFileSync(file, 'utf8')));
const poses = found => found.map(pose => pose.map(([x, y, visibility]) => ({ x, y, visibility })));

const attempts = [], misses = [];
const detector = createDetector({
  onStart: (ts, resumed) => { if (resumed) attempts.pop(); },   // the previous one continues
  onEnd: (start, end, flagged) => attempts.push({ start, end, flagged, logged: end - start >= MIN_MS }),
  onMiss: (ts, why) => misses.push({ ts, why }),
});
normal.frames.forEach(([ts, found], i) =>
  detector.frame(ts, poses(found), normal.w, normal.h, () => poses(flipped.frames[i]?.[1] ?? [])));

const { startTs } = detector.state;   // still up when the video ends
if (startTs !== null) attempts.push({ start: startTs, end: null, flagged: false, logged: false });
console.log(JSON.stringify({ attempts, misses }));
