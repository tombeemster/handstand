---
name: handstand
description: Use for any work on Handstand (folder Documents/Dev/handstand, repo tombeemster/handstand), the phone web app that times handstands with the camera: pose detection rules, testing on recorded videos, the home, record and profile screens, chart, settings and analytics, sounds and speech, or any product decision for it.
---

# Handstand

Read `product.md` before any product decision (the job, principles, scope, decisions) and `design.md` before any visual change (what colours and layout mean). This file covers **how** to work. The README has the serve and test commands.

## Working rules

1. **Climb the ladder before building:** job → the 20% that does it → YAGNI → one source of truth → simplest version. Push back on extras, including your own.
2. **Edit only.** Never commit or push; never start a server or open a browser to check. The maker previews locally, commits and checks the live site. Say what to look at.
3. **Keep each file's line endings** (some files are CRLF). Read before you replace.
4. **Privacy:** the repo is public. Videos (`video/`) and phone exports (`data/`) are gitignored and never go into it.
5. **Words:** a box on screen is a *tile*, never a card: in code, CSS and docs alike. The screens' names are fixed: *Daily records* (the home list tile, her last 5 practice days), *Average best* (the second home tile and the summary row), *Attempts* (the profile segment, `#profile`), *Welcome tutorial* (the settings tile), *Clear* (a day's delete button).
6. **One home per fact:** `product.md` holds what the app does and why, `design.md` how it looks and what the colours mean. The other file points to it, never repeats it. Keep this file's code map and rules in step with any refactor (file moves, renamed tokens, new components).

## Code map

- `detect.js`: **all** detection rules, with no page and no clock. Its comments hold every threshold, why it has that value, and what was tried and dropped. Those comments are the source of truth: don't repeat the numbers elsewhere.
- `app.js`: screens and routing (`#home`, `#record`, `#profile` = Attempts (also `#profile/log`), `#profile/settings` (where the profile icon goes), `#privacy`, `#log/<date>`; no tab bar, and old `#log` links go to `#profile/log`); stats read `counted()`, never `attempts`, so the manual timing setting applies everywhere; log and chart, settings, camera, sound and speech.
- `stats.js`: `RECENT_DAYS` (5), the number of practice days the chart shows, the Daily records list lists and the average covers, and the average best itself (the mean of the best holds over the last 5 practice days, a value on each), pure and tested in `tools/test-stats.mjs`. `practiceDays()` in `app.js` calls it: the days with a counted attempt, no empty days between, shared by the chart, the list and the tile. The stats read `counted()`, never `attempts`.
- `share.js`: draws the record picture on a canvas (`prepareCard` in `app.js` draws it ahead: iPhone only allows sharing straight after a tap).
- `csv.js`: the export format, attempts and not-timed rows, written and read in one place (every imported field is checked: the values end up in the page; a new character in a reason must pass its check too).
- `summary.js`: the anonymous session summary, a pure function (testable in Node). What it puts in must match the privacy page in `index.html`, which shows its output, and `valid` in `worker/index.js`.
- `worker/`: the Cloudflare Worker (and `schema.sql`) that stores the summaries in Supabase. The app imports its `valid`, so there's one set of rules. After changing `index.js`, the maker redeploys with `npx wrangler deploy`; the key is a Worker secret, never in this repo.
- Tests: `node tools/test.mjs` (summary and CSV), `node tools/test-stats.mjs` (the average best), `node worker/test.mjs` (the Worker), `bash worker/test-live.sh <url>` (the deployed Worker; run it yourself in Git Bash, PowerShell has no `bash`, and it stores one row with `app_version` 0.0.0 to delete afterwards).
- `css/`: `tokens.css` (`:root` holds every value), `base.css` (page defaults and the shared pieces: top bar, icon, row, buttons, link, a setting's description, the switch) and `screens.css` (one numbered section per screen, in the app's order). `index.html` loads them in that order, and the order is the cascade: when moving a block, check that no rule of the same specificity changes which one wins.
- `tools/replay.py` + `tools/replay.mjs`: Python finds the poses in recorded videos (cached in `tools/.cache`), Node runs them through the real `detect.js`. One copy of the rules.

## Changing detection

Never tune a rule on a guess.

1. Run every clip through `tools/replay.py`, before and after the change.
2. Establish the truth from the frames themselves: contact sheets and close-ups with the skeleton drawn on. Note what really happened per attempt.
3. Measure the cue across real attempts *and* known failures (hacks, phantoms, false starts) before picking a threshold. Prefer the cue with the widest gap.
4. Accept a change only if it gains without losing on any clip. The replay's near-miss lines show which rule blocked what.
5. Record in the code comment what was measured, and any variant that was tried and dropped.

The baseline is the detection as of Thursday 29 October. Tried on 30 October and undone: asking the camera for 30 fps, and logging an attempt still running when leaving the Record screen. More handstands went untimed and counts appeared that never happened.

Before adding a miss signal, count its false alarms on the recordings too: "seen standing, then lost" fired after nearly every landing. Known traps: the model fits straight front-on handstands upside down (feet as raised hands); it latches onto phantoms (pillows, a mattress, table clutter); live analysis runs at a lower fps than a 30 fps replay; the scratch Python environment gets wiped by temp cleanup.

## Sounds

The chimes are found by listing `sounds/` (see `soundFiles` in `app.js`). Traps met so far:

- **Naming:** a file named `NNs-….mp3` is the chime for holds longer than NN seconds; several with the same NN are variants, played at random without repeating (for now only 1 s has variants, four; the other levels have one chime each). A file starting with `error` is the not-timed sound.
- **Only wav, mp3 or m4a.** iPhone can't decode ogg; convert first (the scratch venv has `soundfile`).
- **Two listings, two shapes:** `npx serve` gives `base` (full name) and `name` (no extension); GitHub's API gives only `name`, with the extension. Read `base` first.
- **The list is loaded once per page:** reload after adding or renaming a file.
- **iPhone's Safari is the baseline:** avoid recent JavaScript (e.g. `Map.groupBy`); one failure there silences every chime.

## Screens

A number both sides need has one home: a token that `app.js` reads (`token()` and `tokenMs()` at the top of `app.js`), or a variable `app.js` sets on the element. Nothing to keep in step by hand:

- **Chart:** `L / W` in `renderChart` is the only copy. It sets `--seconds-width` on `#chart`, and `#chart .seconds` uses it.
- **Swipe to delete:** `--size-button-row-delete` (`tokens.css`) is the Delete button's width; `openWidth()` reads it. The wait before a long-swipe delete reads `--duration-fast`, the rows' own transition.
- **Segments:** `app.js` sets `--segments` (their number) and `--at` (the one on view); `.segments .thumb` follows from them.
- **Screen slides:** `slideFor` in `app.js` decides the direction (the camera from the bottom, the profile from the top, deeper pages from the right, by `DEPTH`); the keyframes are in `css/screens.css` (the last section). A new screen needs a depth. With reduced motion `route()` skips the transition (`calm`), so nothing slides.

Shared sizes live in tokens, not per element: `--size-row` is the height of every row-shaped thing (list rows, tile headers, the segments, full-width buttons); every box is a `.tile`, with an extra class for its kind (`stat`, `day`, `setting`). Every screen starts with a `<header class="topbar">` (`--size-topbar` high: an optional `.icon-button` left, the `h1`, an optional `.icon-button` right; the columns follow from the order, so a new screen only writes the markup); every tappable icon is an `.icon-button` (`--size-tap` square, `--size-icon-500` icon, `--size-icon-600` on the camera). Don't position icons one by one again.

## Styling

- **Tokens:** every value is a token in `css/tokens.css`; a new size or colour is a new token, never a hard-coded value. Names start with their kind (`--color-`, `--space-`, `--size-`, `--radius-`, `--shadow-`, `--font-size-`, `--duration-`, `--ease-`). Spacing, corners and icon sizes share one scale where each 100 is 4 px; the number states the size, so a different size is a new token, not an edited one. Variables set on one element (`--series`, `--dx`, `--at`) are local and have no prefix.
- **JS reads tokens by name:** `app.js` reads `--color-dim`, `--color-wait` and `--color-ready` for the skeleton, plus `--size-button-row-delete` and `--duration-fast` for the swipe; `share.js` reads its colours through its own `token()`. Renaming a token means editing the JS in the same change.
- **Components first:** `.tile` (with `stat`, `day`, `setting`), `.topbar`, `.icon-button`, `.icon`, `.row`, `.button-wide` (with `.button-danger`) and `.link`. Markup the app builds itself (list rows, the swipe-to-delete button, the share row) gets the same looks from selector groups in the CSS, so a change to a component's rule reaches it too. Never style something that already exists by its id.
- **Colours have meanings** (gold for records, red for what can't be undone, amber for not ready, REC red only on the Record button): `design.md` lists them, so check there before using one.

Touch traps: a sideways gesture needs `touch-action: pan-y` on the row so up and down still scroll, and swipe or scroll is decided on the first 8 px of movement. Respect `prefers-reduced-motion` for anything that moves.

## Analytics and not-timed rows

- **A new near-miss reason touches five places:** `MISS_REASONS` in `detect.js`, `MISS_FIELDS` in `summary.js`, `MISSES` in `worker/index.js`, a column in `schema.sql` (and an `alter table` for the live table), and the tests. `OLD_REASONS` in `app.js` only maps wordings of rows already stored or exported. A reason reads the same on screen, in the export and in the debug box.
- **Deploy in this order:** table change in Supabase → `npx wrangler deploy` → push the app. The Worker refuses extra or missing fields, so the other order loses summaries.
- **Supabase rows have no meaningful ids:** only a random `row_id` from the database, so the Table Editor can delete rows. The app never sends or sees it. The maker pastes keys and runs SQL; a key never goes in the chat or the repo.
- **Before concluding something fails on the phone, check the build:** a running app keeps its old code until it's fully closed and reopened, and GitHub Pages caches files for 10 minutes. A whole round of lock tests failed for that reason alone.

## Test data

Give the maker console snippets that write `handstand.attempts` or `handstand.notTimed` in localStorage, and always keep a one-time backup (`<key>.backup`) plus a restore snippet. Real data: `data/load-real-data.js` loads the newest export in `data/` (by the date in its name) when pasted on localhost.