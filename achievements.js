// The achievements: how a time is shown, which achievements there are, when each one unlocks, and the dialog that
// announces a new one. All of it is pure (no clock, no storage, testable in Node) except the dialog at the end,
// which needs the page.
//
// It takes her counted attempts, oldest first, each { day: 'YYYY-MM-DD' (her local date), ms }. The app passes
// counted(), never attempts, so the Manual timing setting applies here like everywhere else and the ATH tile and
// the cups cannot disagree. Unlock state is worked out from the attempts on every call and never stored, so
// deleting a false attempt also takes back what it unlocked. Only "this unlock was already shown" is stored.
//
// Times are compared as the timer shows them (hundredths, rounded down: see "How a time is shown" below), so a tile, a cup and the timer
// cannot disagree. A perfect score is any hold that shows .00 (an ATH or not); level skips need an ATH.
//
// Each achievement has its title in two lines (lines: the break is fixed, so a tile always shows two lines and
// title is the same words in one line, for aria-labels and lists), its trophy's name (for "You've unlocked the
// Gold Cup!") and image (the file in assets/trophies_128/, without .png).
//
// Not here yet: ATH Title and ATH Guardian I and II. They only mean something once the ATH is shared.

// ---- How a time is shown -----------------------------------------------------------------------------------
// One place, so the timer, the log, the tiles, the share picture, the spoken time and the achievements cannot
// disagree. A time is always rounded DOWN, never to the nearest: 4.998 s shows 4.99 and is said as 4.9, so it can
// never look like 5 s, and never unlocks anything from 5 s up.

// A time in hundredths of a second, rounded down: what the timer, the log and the tiles show.
export const centis = ms => Math.floor(ms / 10);

// The time as shown, 2 decimals: 4.99. Built from whole numbers, so no floating-point rounding sneaks in.
export const fmt = ms => {
  const c = centis(ms);
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
};

// The time as said aloud, 1 decimal, also rounded down: 4.998 is 4.9, and 5 s is 5.0. The caller makes it speech
// (drops a ".0", says "punt").
export const fmtSpoken = ms => {
  const t = Math.floor(ms / 100);
  return `${Math.floor(t / 10)}.${t % 10}`;
};

// ---- The achievements ---------------------------------------------------------------------------------------

export const CATEGORIES = ['Hold Time', 'Perfect score', 'Level skip', 'Attempts', 'Streak', 'Activity'];

// A date as a day number, so the gap between two dates is a subtraction. UTC only because it has no
// summer time: the date itself is already her local one.
const dayNumber = day => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

const def = (id, category, lines, trophy, image, test) => ({ id, category, title: lines.join(' '), lines, trophy, image, test });

// Every list below runs from the highest reward down, and so does ACHIEVEMENTS inside each category. This order
// is kept for trophies unlocked on the same attempt and for the locked trophies.
// [seconds, trophy, image]
const HOLDS = [[60, 'Royal Crown', 'top_rank_crown'], [45, 'Diamond Cup', 'gemstone_trophy'], [30, 'Crown Cup', 'crown_trophy'],
  [25, 'Star Cup', 'star_trophy'], [20, 'Double Cup', 'tiered_trophy'], [15, 'Gold Cup', 'gold_trophy_cup'],
  [10, 'Silver Cup', 'silver_trophy_cup'], [5, 'Bronze Cup', 'bronze_trophy_cup']];
// [first second, last second, trophy, image]
const PERFECTS = [[8, Infinity, 'Mega Gem', 'rare_gem_icon'], [5, 7, 'Gem Badge', 'perfect_score_gem'],
  [2, 4, 'Diamond Badge', 'diamond_medal']];
// [levels skipped, first line, second line, trophy, image]: a level is a whole second, as shown
const SKIPS = [[3, 'Skip 3+', 'Levels', 'Gold Wreath', 'laurel_wreath'], [2, 'Skip 2', 'Levels', 'Victory Banner', 'victory_banner'],
  [1, 'Skip 1', 'Level', 'Skip Flag', 'first_win_flag']];
// [attempts, trophy, image]
const COUNTS = [[2000, 'Star Burst', 'xp_burst_star'], [1000, 'Winged Cup', 'winged_trophy'], [500, 'Gold Medal', 'medal_gold_star'],
  [250, 'Silver Medal', 'medal_silver_star'], [100, 'Bronze Medal', 'medal_bronze_star'], [50, 'Thumbs Up Seal', 'thumbs_up_seal'],
  [1, 'Checkmark Seal', 'checkmark_seal']];
// [days in a row, trophy, image]
const STREAKS = [[7, 'Sunburst Badge', 'sunburst_medal'], [5, 'Rocket Badge', 'rocket_medal'], [4, 'Lightning Badge', 'lightning_medal'],
  [3, 'Flame Badge', 'flame_medal'], [2, 'Flame Starter', 'streak_flame_icon']];
// [practice days, trophy, image]
const DAYS = [[30, 'Crown Badge', 'crown_medal'], [20, 'Heart Badge', 'heart_medal'], [10, 'Star Badge', 'star_medal']];

// test(a) is asked after each attempt; the first attempt it is true for unlocks the achievement. a holds that
// attempt (centis, skipped, perfect, gap) and the totals so far (streak, days, count, totalMs).
export const ACHIEVEMENTS = [
  ...HOLDS.map(([s, trophy, image]) => def(`hold-${s}`, 'Hold Time', [`${s} s`, 'Handstand'], trophy, image, a => a.centis >= s * 100)),
  ...PERFECTS.map(([from, to, trophy, image]) => def(`perfect-${from}`, 'Perfect score', ['Perfect', `Score ${from}+`], trophy, image,
    a => a.perfect >= from && a.perfect <= to)),
  ...SKIPS.map(([n, one, two, trophy, image]) => def(`skip-${n}`, 'Level skip', [one, two], trophy, image, a => a.skipped >= n)),
  ...COUNTS.map(([n, trophy, image]) => def(`count-${n}`, 'Attempts', n === 1 ? ['First', 'Attempt'] : [`${n}`, 'Attempts'], trophy, image,
    a => a.count >= n)),
  ...STREAKS.map(([n, trophy, image]) => def(`streak-${n}`, 'Streak', [`${n} Day`, 'Streak'], trophy, image, a => a.streak >= n)),
  def('total-30min', 'Activity', ['30 Min', 'Total'], 'Platinum Stopwatch', 'speedrun_stopwatch', a => a.totalMs >= 30 * 60 * 1000),
  ...DAYS.map(([n, trophy, image]) => def(`days-${n}`, 'Activity', [`${n} Practice`, 'Days'], trophy, image, a => a.days >= n)),
  def('back-after-3', 'Activity', ['Back After', '3+ Days'], 'Padlock Badge', 'unlocked_padlock', a => a.gap >= 3),
];

// For each achievement, in ACHIEVEMENTS order: whether it is unlocked and at which attempt (its index in
// attempts, so the screen can show that attempt's day and exact time, and the Record screen can ask which
// ones the newest attempt unlocked). at is -1 while locked.
export function evaluate(attempts) {
  const at = ACHIEVEMENTS.map(() => -1);
  let ath = null;          // the longest hold so far, in ms
  let prevDay = null;
  let streak = 0, days = 0, totalMs = 0;

  attempts.forEach((attempt, index) => {
    const t = centis(attempt.ms);
    const day = dayNumber(attempt.day);

    // Days: the gap to the previous practice day in dates (Monday to Thursday is 3), and the streak with it.
    let gap = 0;
    if (prevDay === null) { streak = 1; days = 1; }
    else if (day !== prevDay) { gap = day - prevDay; streak = gap === 1 ? streak + 1 : 1; days++; }
    prevDay = day;
    totalMs += attempt.ms;

    // ATH: only an attempt that beats the ATH can skip levels. The very first one has no ATH to skip.
    const isAth = ath === null || attempt.ms > ath;
    const skipped = isAth && ath !== null ? Math.max(0, Math.floor(t / 100) - Math.floor(centis(ath) / 100) - 1) : 0;
    const perfect = t % 100 === 0 ? t / 100 : 0;   // any hold that shows n.00, whatever the ATH is
    if (isAth) ath = attempt.ms;

    const a = { centis: t, skipped, perfect, gap, streak, days, totalMs, count: index + 1 };
    ACHIEVEMENTS.forEach((def, i) => { if (at[i] < 0 && def.test(a)) at[i] = index; });
  });

  return ACHIEVEMENTS.map((def, i) => ({ id: def.id, unlocked: at[i] >= 0, at: at[i] }));
}

// What the app has to hand: its counted attempts ({ started_at, duration_ms, ... }, any order), as evaluate wants them.
export const asInput = attempts => [...attempts]
  .sort((p, q) => p.started_at.localeCompare(q.started_at))
  .map(a => ({ day: a.started_at.slice(0, 10), ms: a.duration_ms }));

// For the screen: the categories in CATEGORIES order, each with its achievements as { id, title, lines, trophy, image,
// unlocked, at, day, ms }: unlocked ones first, in the order they were earned, then the locked ones.
// day and ms are those of the attempt that unlocked it.
export function groups(attempts) {
  const input = asInput(attempts);
  const state = new Map(evaluate(input).map(r => [r.id, r]));
  return CATEGORIES.map(category => {
    const items = ACHIEVEMENTS.filter(a => a.category === category).map(({ test, ...a }) => {
      const { unlocked, at } = state.get(a.id);
      return { ...a, unlocked, at, day: unlocked ? input[at].day : null, ms: unlocked ? input[at].ms : null };
    });
    const unlocked = items.filter(i => i.unlocked).sort((a, b) => a.at - b.at);
    return { category, items: [...unlocked, ...items.filter(i => !i.unlocked)] };
  }).filter(group => group.items.some(item => item.unlocked));
}

// The second row of the trophy modal: the time of the hold that unlocked it, for the achievements that come from
// one hold. The others have no second row (null). item is one of the items groups() returns, unlocked.
const TIMED = new Set(['Hold Time', 'Perfect score', 'Level skip']);
export const trophyExtra = item => (TIMED.has(item.category) ? ['Time', `${fmt(item.ms)} s`] : null);

// The ids unlocked now, and the unlocked ones not announced yet (seen: the ids announced so far), in screen order.
// The unlock dialog asks for these after an attempt.
export const unlockedIds = attempts => evaluate(asInput(attempts)).filter(r => r.unlocked).map(r => r.id);
export function newUnlocks(attempts, seen) {
  const known = new Set(seen);
  return groups(attempts).flatMap(g => g.items).filter(i => i.unlocked && !known.has(i.id));
}

// What is still announced: the seen ids that are still earned. Deleting attempts (Delete all, or one that unlocked
// something) must make an unlock new again, or re-earning it after a clear would stay silent.
export function stillSeen(attempts, seen) {
  const earned = new Set(unlockedIds(attempts));
  return seen.filter(id => earned.has(id));
}

// ---- The unlock dialog ---------------------------------------------------------------------------------------
// After an attempt, once for each achievement that is new, one after the other. Needs the page (a <dialog> it makes
// itself), so it is not tested in Node; what decides what is new (newUnlocks above) is.
//
// SEEN holds the ids already announced. The first time ever, everything already earned counts as announced, so an
// existing log does not open with a dozen dialogs. The app calls forget() whenever attempts are saved, so what is
// no longer earned (Delete all, or one deleted attempt) is announced again when it is re-earned.
const SEEN = 'handstand.achievementsSeen';

// The trophy pictures, for here and for app.js: the tiles (64 px on screen) and the dialogs (200 px on screen)
export const TROPHIES = 'assets/trophies_128/';
export const TROPHIES_LARGE = 'assets/trophies_256/';

export function initUnlockDialog({ counted, recall, remember, screen }) {
  // Why it did not open shows in the console (Safari: Develop > the phone > Console), so a silence can be explained
  const log = (...say) => console.info('[unlock dialog]', ...say);

  if (recall(SEEN, null) === null) remember(SEEN, unlockedIds(counted()));

  function show() {
    if (screen() !== 'record') return log('not shown: the screen is', screen(), '(it waits for the next attempt)');
    let d = document.getElementById('unlock-modal');
    if (d?.open) return log('not shown: a dialog is open (the next one follows its Close)');
    const seen = recall(SEEN, []);
    const item = newUnlocks(counted(), seen)[0];
    if (!item) return log('not shown: nothing new; earned', unlockedIds(counted()).length, ', announced', seen.length);
    remember(SEEN, [...seen, item.id]);
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'unlock-modal';
      d.className = 'trophy-dialog trophy-unlock';
      d.onclick = e => { if (e.target === d) d.close(); };
      d.onclose = () => { if (d.dataset.go) delete d.dataset.go; else show(); };
      document.body.append(d);
    }
    d.setAttribute('aria-labelledby', 'unlock-title');
    d.innerHTML = `
      <div class="tile trophy-body">
        <img class="trophy-art" src="${TROPHIES_LARGE}${item.image}.png" alt="" width="200" height="200">
        <div class="trophy-msg">
          <p class="trophy-name">New Achievement</p>
          <h2 id="unlock-title">${item.title}</h2>
          <p class="unlock-line">You’ve unlocked the<br>${item.trophy}!</p>
        </div>
      </div>
      <div class="trophy-buttons"><button class="button-wide button-gold view">View achievements</button><button class="button-wide close">Close</button></div>`;
    d.querySelector('.close').onclick = () => d.close();
    d.querySelector('.view').onclick = () => {
      remember(SEEN, unlockedIds(counted()));   // looking at them is seeing them
      d.dataset.go = '1';
      d.close();
      location.hash = '#profile/achievements';
    };
    d.showModal();
    log('shown:', item.id);
  }

  const forget = () => remember(SEEN, stillSeen(counted(), recall(SEEN, [])));
  return { show, forget };
}