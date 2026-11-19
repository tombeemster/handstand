// Tests for achievements.js. Run: node tools/test-achievements.mjs  (fold into tools/test.mjs when convenient)
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, CATEGORIES, asInput, centis, evaluate, fmt, fmtSpoken, groups, newUnlocks, stillSeen, trophyExtra, unlockedIds } from '../achievements.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

const day = d => '2026-11-' + String(d).padStart(2, '0');
const att = (d, ms) => ({ day: day(d), ms });
// id -> the attempt it unlocked at, for the unlocked ones only
const got = attempts => Object.fromEntries(evaluate(attempts).filter(r => r.unlocked).map(r => [r.id, r.at]));

ok('31 achievements, each id once, each in a known category', () => {
  assert.equal(ACHIEVEMENTS.length, 31);
  assert.equal(new Set(ACHIEVEMENTS.map(a => a.id)).size, 31);
  assert.ok(ACHIEVEMENTS.every(a => CATEGORIES.includes(a.category)));
});

ok('the categories are in the order of the screen', () => {
  assert.deepEqual(CATEGORIES, ['Hold Time', 'Perfect score', 'Level skip', 'Attempts', 'Streak', 'Activity']);
  assert.deepEqual([...new Set(ACHIEVEMENTS.map(a => a.category))], CATEGORIES);
});

ok('achievement definitions list each category highest reward first', () => {
  const ids = c => ACHIEVEMENTS.filter(a => a.category === c).map(a => a.id);
  assert.deepEqual(ids('Hold Time'), ['hold-60', 'hold-45', 'hold-30', 'hold-25', 'hold-20', 'hold-15', 'hold-10', 'hold-5']);
  assert.deepEqual(ids('Perfect score'), ['perfect-8', 'perfect-5', 'perfect-2']);
  assert.deepEqual(ids('Level skip'), ['skip-3', 'skip-2', 'skip-1']);
  assert.deepEqual(ids('Attempts'), ['count-2000', 'count-1000', 'count-500', 'count-250', 'count-100', 'count-50', 'count-1']);
  assert.deepEqual(ids('Streak'), ['streak-7', 'streak-5', 'streak-4', 'streak-3', 'streak-2']);
  assert.deepEqual(ids('Activity'), ['total-30min', 'days-30', 'days-20', 'days-10', 'back-after-3']);
});

ok('every title is two lines, broken where the design breaks it', () => {
  assert.ok(ACHIEVEMENTS.every(a => a.lines.length === 2 && a.lines.every(l => l.length > 0 && l === l.trim())));
  const lines = id => ACHIEVEMENTS.find(a => a.id === id).lines;
  assert.deepEqual(lines('hold-5'), ['5 s', 'Handstand']);
  assert.deepEqual(lines('hold-60'), ['60 s', 'Handstand']);
  assert.deepEqual(lines('perfect-5'), ['Perfect', 'Score 5+']);
  assert.deepEqual(lines('skip-3'), ['Skip 3+', 'Levels']);
  assert.deepEqual(lines('count-1'), ['First', 'Attempt']);
  assert.deepEqual(lines('days-30'), ['30 Practice', 'Days']);
  assert.deepEqual(lines('back-after-3'), ['Back After', '3+ Days']);
  assert.equal(ACHIEVEMENTS.find(a => a.id === 'hold-5').title, '5 s Handstand');
});

const FILES = new Set(['explorer_map_badge', 'first_place_ribbon', 'first_win_flag', 'flame_medal', 'gemstone_trophy', 'gold_trophy_cup', 'heart_medal',
  'key_seal', 'laurel_wreath', 'legend_sword_shield', 'level_up_arrow', 'lightning_medal', 'master_hammer', 'medal_bronze_star', 'medal_gold_star',
  'medal_silver_star', 'milestone_flag', 'mountain_peak_medal', 'perfect_score_gem', 'rare_gem_icon', 'rocket_medal', 'shield_medal', 'shield_trophy',
  'silver_trophy_cup', 'speedrun_stopwatch', 'star_medal', 'star_trophy', 'streak_flame_icon', 'sunburst_medal', 'target_seal', 'thumbs_up_seal',
  'tiered_trophy', 'top_rank_crown', 'unlocked_padlock', 'victory_banner', 'victory_cup_with_flag', 'winged_trophy', 'xp_burst_star', 'book_seal',
  'bronze_trophy_cup', 'championship_belt', 'checkmark_seal', 'collector_jar', 'compass_seal', 'completionist_chest', 'crown_medal', 'crown_trophy',
  'diamond_medal']);

ok('every achievement has its own image, a file in assets/trophies_128', () => {
  assert.ok(ACHIEVEMENTS.every(a => FILES.has(a.image)), ACHIEVEMENTS.filter(a => !FILES.has(a.image)).map(a => a.image).join());
  assert.equal(new Set(ACHIEVEMENTS.map(a => a.image)).size, ACHIEVEMENTS.length);
});

ok('asInput: oldest first, a date and a duration', () => {
  const r = asInput([{ started_at: '2026-11-02T10:00:00', duration_ms: 5000, method: 'auto' }, { started_at: '2026-11-01T09:00:00', duration_ms: 4000, method: 'auto' }]);
  assert.deepEqual(r, [{ day: '2026-11-01', ms: 4000 }, { day: '2026-11-02', ms: 5000 }]);
});


ok('evaluate answers in ACHIEVEMENTS order', () => {
  assert.deepEqual(evaluate([]).map(r => r.id), ACHIEVEMENTS.map(a => a.id));
});

ok('no attempts: nothing unlocked', () => assert.deepEqual(got([]), {}));

ok('the first attempt: First Attempt, and nothing else', () => assert.deepEqual(got([att(1, 4120)]), { 'count-1': 0 }));

ok('a hold unlocks the cup at the attempt that reaches it', () => {
  const r = got([att(1, 3000), att(1, 5000), att(1, 12000)]);
  assert.equal(r['hold-5'], 1);
  assert.equal(r['hold-10'], 2);
  assert.equal(r['hold-15'], undefined);
});

ok('a hold counts as the timer shows it, rounded down: 4.998 s shows 4.99 and unlocks no 5 s cup', () => {
  assert.equal(centis(4998), 499);
  assert.equal(got([att(1, 4998)])['hold-5'], undefined);
  assert.equal(got([att(1, 4999)])['hold-5'], undefined);
  assert.equal(got([att(1, 5000)])['hold-5'], 0);
  assert.equal(got([att(1, 9999)])['hold-10'], undefined);
});

ok('a hold beyond a level also unlocks the lower cups', () => {
  const r = got([att(1, 31000)]);
  assert.deepEqual(['hold-5', 'hold-10', 'hold-15', 'hold-20', 'hold-25', 'hold-30'].map(id => r[id]), [0, 0, 0, 0, 0, 0]);
  assert.equal(r['hold-45'], undefined);
});

ok('the last cup is at 60 s', () => {
  assert.equal(got([att(1, 60000)])['hold-60'], 0);
  assert.equal(got([att(1, 59999)])['hold-60'], undefined);
});

ok('level skip: 3.40 to 5.00 skips one level', () => {
  const r = got([att(1, 3400), att(1, 5000)]);
  assert.equal(r['skip-1'], 1);
  assert.equal(r['skip-2'], undefined);
});

ok('level skip: 3.40 to 4.80 is the next level, not a skip', () => {
  const r = got([att(1, 3400), att(1, 4800)]);
  assert.equal(r['skip-1'], undefined);
});

ok('level skip: 4.998 is still level 4, so 3.40 to 4.998 skips nothing', () => {
  assert.equal(got([att(1, 3400), att(1, 4998)])['skip-1'], undefined);
  assert.equal(got([att(1, 3400), att(1, 5998)])['skip-1'], 1);
});

ok('level skip: 3.99 to 5.00 skips one, 3.00 to 7.20 skips three or more', () => {
  assert.equal(got([att(1, 3990), att(1, 5000)])['skip-1'], 1);
  const r = got([att(1, 3000), att(1, 7200)]);
  assert.deepEqual([r['skip-1'], r['skip-2'], r['skip-3']], [1, 1, 1]);
});

ok('level skip: the first attempt has no ATH to skip, a weaker one is no ATH', () => {
  assert.deepEqual(Object.keys(got([att(1, 8000)])).filter(id => id.startsWith('skip')), []);
  const r = got([att(1, 3400), att(1, 1500), att(1, 4100)]);
  assert.equal(r['skip-1'], undefined);
});

ok('level skip is measured against the ATH, not the last attempt', () => {
  const r = got([att(1, 3400), att(1, 3000), att(1, 6000)]);
  assert.equal(r['skip-2'], 2);
});

ok('perfect score: an ATH that shows n.00, in its tier', () => {
  assert.equal(got([att(1, 3120), att(1, 4000)])['perfect-2'], 1);
  assert.equal(got([att(1, 3120), att(1, 6004)])['perfect-5'], 1);   // shows 6.00
  assert.equal(got([att(1, 3120), att(1, 8000)])['perfect-8'], 1);
  assert.equal(got([att(1, 3120), att(1, 11000)])['perfect-8'], 1);
});

ok('perfect score: one tier only, never the lower ones', () => {
  const r = got([att(1, 6000)]);
  assert.deepEqual(Object.keys(r).filter(id => id.startsWith('perfect')), ['perfect-5']);
});

ok('perfect score: only a time that shows .00: 7.009 does, 7.01 and 4.998 do not', () => {
  assert.equal(got([att(1, 3120), att(1, 7009)])['perfect-5'], 1);
  assert.equal(got([att(1, 3120), att(1, 7010)])['perfect-5'], undefined);
  assert.equal(got([att(1, 3120), att(1, 4998)])['perfect-2'], undefined);
});

ok('perfect score: a time that does not show a whole second is not perfect', () => {
  assert.deepEqual(Object.keys(got([att(1, 6100), att(1, 7500), att(1, 8120)])).filter(id => id.startsWith('perfect')), []);
});

ok('perfect score: any hold that shows .00 counts, also far below the ATH; under 2 s does not', () => {
  assert.equal(got([att(1, 9450), att(1, 2000)])['perfect-2'], 1);
  assert.equal(got([att(1, 5230), att(1, 3000)])['perfect-2'], 1);
  assert.deepEqual(Object.keys(got([att(1, 1000)])).filter(id => id.startsWith('perfect')), []);
});

ok('streak: days in a row, several attempts on one day count once', () => {
  const r = got([att(1, 4000), att(1, 4000), att(2, 4000), att(3, 4000)]);
  assert.equal(r['streak-2'], 2);
  assert.equal(r['streak-3'], 3);
  assert.equal(r['streak-4'], undefined);
});

ok('streak: a missed day starts again', () => {
  const r = got([att(1, 4000), att(3, 4000), att(4, 4000)]);
  assert.equal(r['streak-2'], 2);
  assert.equal(r['streak-3'], undefined);
});

ok('streak: over the end of a month', () => {
  const r = got([{ day: '2026-11-30', ms: 4000 }, { day: '2026-12-01', ms: 4000 }]);
  assert.equal(r['streak-2'], 1);
});

ok('streak: 7 days', () => {
  const r = got([1, 2, 3, 4, 5, 6, 7].map(d => att(d, 4000)));
  assert.equal(r['streak-7'], 6);
});

ok('back after: a gap of 3 dates, not 2, and never on the first attempt', () => {
  assert.equal(got([att(1, 4000), att(4, 4000)])['back-after-3'], 1);
  assert.equal(got([att(1, 4000), att(3, 4000)])['back-after-3'], undefined);
  assert.equal(got([att(1, 4000)])['back-after-3'], undefined);
});

ok('practice days: 10 different days, extra attempts on a day do not add', () => {
  const nine = [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(d => [att(d, 4000), att(d, 5000)]);
  assert.equal(got(nine)['days-10'], undefined);
  assert.equal(got([...nine, att(10, 4000)])['days-10'], 18);
});

ok('30 Min Total: the counted holds add up', () => {
  assert.equal(got([att(1, 900000), att(1, 900000)])['total-30min'], 1);
  assert.equal(got([att(1, 900000), att(1, 899999)])['total-30min'], undefined);
});

ok('attempts: 50 unlocks on the 50th', () => {
  const fifty = Array.from({ length: 50 }, () => att(1, 4000));
  const r = got(fifty);
  assert.equal(r['count-50'], 49);
  assert.equal(r['count-100'], undefined);
  assert.equal(got(fifty.slice(1))['count-50'], undefined);
});

ok('derived, not stored: take the attempt away and what it unlocked goes with it', () => {
  const withFalse = [att(1, 4000), att(1, 21000)];
  assert.equal(got(withFalse)['hold-20'], 1);
  assert.equal(got(withFalse.slice(0, 1))['hold-20'], undefined);
});

ok('groups show unlocked trophies in earning order, followed by locked trophies', () => {
  const attempts = [
    { started_at: '2026-11-01T10:00:00', duration_ms: 5000 },
    { started_at: '2026-11-02T10:00:00', duration_ms: 10000 },
    { started_at: '2026-11-03T10:00:00', duration_ms: 15000 },
  ];
  const holds = groups(attempts).find(group => group.category === 'Hold Time').items;
  assert.deepEqual(holds.slice(0, 3).map(item => item.id), ['hold-5', 'hold-10', 'hold-15']);
  assert.ok(holds.slice(0, 3).every(item => item.unlocked));
  assert.ok(holds.slice(3).every(item => !item.unlocked));
  assert.deepEqual(holds.slice(3).map(item => item.id), ['hold-60', 'hold-45', 'hold-30', 'hold-25', 'hold-20']);
});

ok('groups hide categories with no unlocked trophies', () => {
  assert.deepEqual(groups([]), []);
  assert.deepEqual(groups([{
    started_at: '2026-11-01T10:00:00',
    duration_ms: 4120,
  }]).map(group => group.category), ['Attempts']);
});

ok('trophyExtra: the time of the unlocking hold for timed achievements, rounded down; none for the others', () => {
  const log = [5009, 12340].map((ms, i) => ({ started_at: `2026-11-0${i + 1}T10:00:00`, duration_ms: ms, method: 'auto' }));
  const items = groups(log).flatMap(g => g.items).filter(i => i.unlocked);
  const get = id => items.find(i => i.id === id);
  assert.deepEqual(trophyExtra(get('hold-5')), ['Time', '5.00 s']);
  assert.deepEqual(trophyExtra(get('hold-10')), ['Time', '12.34 s']);
  assert.deepEqual(trophyExtra(get('skip-1')), ['Time', '12.34 s']);
  assert.equal(trophyExtra(get('count-1')), null);
  assert.equal(trophyExtra(get('streak-2')), null);
});

const log = ms => ms.map((d, i) => ({ started_at: `2026-11-01T10:0${i}:00`, duration_ms: d, method: 'auto' }));

ok('unlockedIds: what an attempt has earned', () => {
  assert.deepEqual(unlockedIds(log([5129])).sort(), ['count-1', 'hold-5']);
  assert.deepEqual(unlockedIds([]), []);
});

ok('newUnlocks: only what was not announced yet, the first attempt first announced as First Attempt', () => {
  assert.deepEqual(newUnlocks(log([4120]), []).map(i => i.id), ['count-1']);
  const seen = unlockedIds(log([4120]));
  assert.deepEqual(newUnlocks(log([4120, 5300]), seen).map(i => i.id), ['hold-5']);
  assert.deepEqual(newUnlocks(log([4120, 5300]), unlockedIds(log([4120, 5300]))), []);
});

ok('newUnlocks: one attempt that earns several, in screen order (Hold Time before Level skip), with its time', () => {
  const r = newUnlocks(log([3120, 12340]), unlockedIds(log([3120])));
  assert.equal(r[0].id, 'hold-10');
  assert.deepEqual(r.map(i => i.id).sort(), ['hold-10', 'hold-5', 'skip-1', 'skip-2', 'skip-3']);
  assert.ok(r.every(i => i.ms === 12340));
});

ok('newUnlocks: a deleted attempt takes its unlocks back; announced ones are not announced twice', () => {
  const seen = unlockedIds(log([4120, 6000]));
  assert.deepEqual(newUnlocks(log([4120]), seen), []);
  assert.deepEqual(newUnlocks(log([4120, 6000]), seen), []);
});

ok('stillSeen: clearing the log forgets what was announced, so it is announced again when re-earned', () => {
  const seen = unlockedIds(log([4120, 6000]));
  assert.deepEqual(stillSeen([], seen), []);
  assert.deepEqual(newUnlocks(log([4120]), stillSeen([], seen)).map(i => i.id), ['count-1']);
});

ok('stillSeen: deleting one attempt forgets only what it earned, and never adds anything', () => {
  const seen = unlockedIds(log([4120, 6000]));
  assert.deepEqual(stillSeen(log([4120]), seen), ['count-1']);
  assert.deepEqual(stillSeen(log([4120, 6000]), seen).sort(), seen.sort());
  assert.deepEqual(stillSeen(log([4120, 6000]), ['count-1']), ['count-1']);
});

// ---- how a time is shown (was test-time.mjs)

console.log(`${n} passed`);
