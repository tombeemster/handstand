---
name: handstand
description: Use for any work on Handstand, the phone web app that times handstands with the camera: pose detection rules, testing on recorded videos, the home, record and profile screens, chart, settings and analytics, sounds and speech, or any product decision for it.
---

# Handstand

Read `PRODUCT.md` before any product decision (the job, principles, scope, decisions) and `DESIGN.md` before any visual change (what colours and layout mean). Use `TERMINOLOGY.md` for every name and definition. The README has the serve, test and replay commands.

This file covers **how** to work and what in the code is coupled.

## Working rules

1. **Climb the ladder before building:** job → the 20% that does it → YAGNI → one source of truth → simplest version. Push back on extras, including your own.
2. **Edit only.** Never commit or push; never start a server or open a browser to check. The maker previews locally, commits, runs the tests that need a shell of their own, and checks the live site. Say what to look at.
3. **Keep each file's line endings** (some files are CRLF). Read before you replace.
4. **Privacy:** the repo is public. Videos (`video/`) and phone exports (`data/`) are gitignored and never go into it.
5. **Words:** use the terms in `TERMINOLOGY.md`, in code, CSS and docs alike. Don't define a term anywhere else.
6. **One home per fact:**
   - `PRODUCT.md`: what the app does and why.
   - `DESIGN.md`: how it looks and what the tokens mean.
   - `TERMINOLOGY.md`: names and definitions.
   - `README.md`: files, commands, sounds.
   - `detect.js` comments: every detection threshold, why it has that value, and what was tried and dropped.
   - This file: how to work, and what the code couples.

   The other files point to the home, never repeat it. Keep this file's code map and rules in step with any refactor (file moves, renamed tokens, new components).

## Code map

- `detect.js`: **all** detection rules, with no page and no clock.
- `app.js`: screens and routing (`#home`, `#record`, `#profile` = Attempts (also `#profile/log`), `#profile/settings` (where the profile icon goes), `#privacy`, `#log/<date>`; old `#log` links go to `#profile/log`); log and chart, settings, camera, sound and speech. Stats read `counted()`, never `attempts`, so the manual timing setting applies everywhere.
- `stats.js`: `RECENT_DAYS`, practice days, daily highs and the Average best; pure and tested in `tools/test-stats.mjs`. `practiceDays()` in `app.js` calls it and is shared by the chart, Daily records and the Average best tile.
- `share.js`: draws the record picture on a canvas (`prepareCard` in `app.js` draws it ahead: iPhone only allows sharing straight after a tap).
- `csv.js`: the export format, attempts and not-timed rows, written and read in one place (every imported field is checked: the values end up in the page; a new character in a reason must pass its check too).
- `summary.js`: the anonymous session summary, a pure function (testable in Node). What it puts in must match the privacy page in `index.html`, which shows its output, and `valid` in `worker/index.js`.
- `worker/`: the Cloudflare Worker (and `schema.sql`) that stores the summaries in Supabase. The app imports its `valid`, so there's one set of rules. After changing `index.js`, the maker redeploys with `npx wrangler deploy`; the key is a Worker secret, never in this repo.
- `css/`: `tokens.css` (`:root` holds every value), `base.css` (page defaults and the shared pieces) and `screens.css` (one numbered section per screen, in the app's order). `index.html` loads them in that order, and the order is the cascade: when moving a block, check that no rule of the same specificity changes which one wins.
- `tools/replay.py` + `tools/replay.mjs`: Python finds the poses in recorded videos (cached in `tools/.cache`), Node runs them through the real `detect.js`. One copy of the rules.
- `sounds/`, `icons/`, `site.webmanifest` : see the README.

## Changing detection

Never tune a rule on a guess.

1. Run every clip through `tools/replay.py`, before and after the change.
2. Establish the truth from the frames themselves: contact sheets and close-ups with the skeleton drawn on. Note what really happened per attempt.
3. Measure the cue across real attempts *and* known failures (hacks, phantoms, false starts) before picking a threshold. Prefer the cue with the widest gap.
4. Accept a change only if it gains without losing on any clip. The replay's near-miss lines show which rule blocked what.
5. Record in the `detect.js` comment what was measured, and any variant that was tried and dropped.

Before adding a miss signal, count its false alarms on the recordings too: "seen standing, then lost" fired after nearly every landing. Known traps: the model fits straight front-on handstands upside down (feet as raised hands); it latches onto phantoms (pillows, a mattress, table clutter); live analysis runs at a lower fps than a 30 fps replay; the scratch Python environment gets wiped by temp cleanup.

## Sounds

The chimes are found by listing `sounds/` (see `soundFiles` in `app.js`; naming and formats are in the README). Traps met so far:

- **ogg:** iPhone can't decode it; convert first (the scratch venv has `soundfile`).
- **Two listings, two shapes:** `npx serve` gives `base` (full name) and `name` (no extension); GitHub's API gives only `name`, with the extension. Read `base` first.
- **The list is loaded once per page:** reload after adding or renaming a file.
- **iPhone's Safari is the baseline:** avoid recent JavaScript (e.g. `Map.groupBy`); one failure there silences every chime.

## Numbers and tokens shared by CSS and JS

A number both sides need has one home: a token that `app.js` reads (`token()` and `tokenMs()` at the top of `app.js`), or a variable `app.js` sets on the element. Nothing to keep in step by hand. This is the one list of what JS reads; renaming any of these tokens means editing the JS in the same change:

- **Skeleton:** `app.js` reads `--color-dim`, `--color-wait` and `--color-ready`.
- **Swipe to delete:** `openWidth()` reads `--size-button-row-delete` (the Delete button's width); the wait before a long-swipe delete reads `--duration-fast`, the rows' own transition.
- **Share picture:** `share.js` reads its colours through its own `token()`.
- **Chart:** `L / W` in `renderChart` is the only copy. It sets `--seconds-width` on `#chart`, and `#chart .seconds` uses it.
- **Segments:** `app.js` sets `--segments` (their number) and `--at` (the one on view); `.segments .thumb` follows from them.
- **Screen slides:** `slideFor` in `app.js` decides the direction (by `DEPTH`); the keyframes are in `css/screens.css` (the last section). A new screen needs a depth. With reduced motion `route()` skips the transition (`calm`), so nothing slides.

Touch traps: a sideways gesture needs `touch-action: pan-y` on the row so up and down still scroll, and swipe or scroll is decided on the first 8 px of movement.

## Analytics and not-timed rows

- **A new near-miss reason touches five places:** `MISS_REASONS` in `detect.js`, `MISS_FIELDS` in `summary.js`, `MISSES` in `worker/index.js`, a column in `schema.sql` (and an `alter table` for the live table), and the tests. `OLD_REASONS` in `app.js` only maps wordings of rows already stored or exported. A reason reads the same on screen, in the export and in the debug box.
- **Deploy in this order:** table change in Supabase → `npx wrangler deploy` → push the app. The Worker refuses extra or missing fields, so the other order loses summaries.
- **Supabase rows have no meaningful ids:** only a random `row_id` from the database, so the Table Editor can delete rows. The app never sends or sees it. The maker pastes keys and runs SQL; a key never goes in the chat or the repo.
- **The live Worker test is the maker's to run** (`worker/test-live.sh`, see the README): it needs bash and stores a row to delete afterwards.
- **Before concluding something fails on the phone, check the build:** a running app keeps its old code until it's fully closed and reopened, and GitHub Pages caches files for 10 minutes. A whole round of lock tests failed for that reason alone.

## Test data

Give the maker console snippets that write `handstand.attempts` or `handstand.notTimed` in localStorage, and always keep a one-time backup (`<key>.backup`) plus a restore snippet. Real data: `data/load-real-data.js` loads the newest export in `data/` (by the date in its name) when pasted on localhost.