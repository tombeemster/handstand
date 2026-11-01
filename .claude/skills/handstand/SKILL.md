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
5. **Words:** a box on screen is a *tile*, never a card: in code, CSS and docs alike.

## Code map

- `detect.js`: **all** detection rules, with no page and no clock. Its comments hold every threshold, why it has that value, and what was tried and dropped. Those comments are the source of truth: don't repeat the numbers elsewhere.
- `app.js`: screens and routing (`#home`, `#record`, `#profile` = All attempts (also `#profile/log`), `#profile/settings` (where the profile icon goes), `#privacy`, `#log/<date>`; no tab bar, and old `#log` links go to `#profile/log`); stats read `counted()`, never `attempts`, so the manual timing setting applies everywhere; log and chart, settings, camera, sound and speech.
- `share.js`: draws the record picture on a canvas (`prepareCard` in `app.js` draws it ahead: iPhone only allows sharing straight after a tap).
- `csv.js`: the export format, written and read in one place (every imported field is checked: the values end up in the page).
- `summary.js`: the anonymous session summary, a pure function (testable in Node). What it puts in must match the privacy page in `index.html`, which shows its output, and `valid` in `worker/index.js`.
- `worker/`: the Cloudflare Worker (and `schema.sql`) that stores the summaries in Supabase. The app imports its `valid`, so there's one set of rules. After changing `index.js`, the maker redeploys with `npx wrangler deploy`; the key is a Worker secret, never in this repo.
- Tests: `node tools/test.mjs` (summary and CSV), `node worker/test.mjs` (the Worker).
- `style.css`: tokens first (`:root` holds every value; see `design.md` for their meaning).
- `tools/replay.py` + `tools/replay.mjs`: Python finds the poses in recorded videos (cached in `tools/.cache`), Node runs them through the real `detect.js`. One copy of the rules.

## Changing detection

Never tune a rule on a guess.

1. Run every clip through `tools/replay.py`, before and after the change.
2. Establish the truth from the frames themselves: contact sheets and close-ups with the skeleton drawn on. Note what really happened per attempt.
3. Measure the cue across real attempts *and* known failures (hacks, phantoms, false starts) before picking a threshold. Prefer the cue with the widest gap.
4. Accept a change only if it gains without losing on any clip. The replay's near-miss lines show which rule blocked what.
5. Record in the code comment what was measured, and any variant that was tried and dropped.

Before adding a miss signal, count its false alarms on the recordings too: "seen standing, then lost" fired after nearly every landing. Known traps: the model fits straight front-on handstands upside down (feet as raised hands); it latches onto phantoms (pillows, a mattress, table clutter); live analysis runs at a lower fps than a 30 fps replay; the scratch Python environment gets wiped by temp cleanup.

## Sounds

The chimes are found by listing `sounds/` (see `soundFiles` in `app.js`). Traps met so far:

- **Only wav, mp3 or m4a.** iPhone can't decode ogg; convert first (the scratch venv has `soundfile`).
- **Two listings, two shapes:** `npx serve` gives `base` (full name) and `name` (no extension); GitHub's API gives only `name`, with the extension. Read `base` first.
- **The list is loaded once per page:** reload after adding or renaming a file.
- **iPhone's Safari is the baseline:** avoid recent JavaScript (e.g. `Map.groupBy`); one failure there silences every chime.

## Screens

Values that live in both `app.js` and `style.css` (keep them in step; each side's comment names the other):

- **Chart:** two drawings at one scale, the fixed seconds labels and the scrolling plot. Their split is `L / W` in `renderChart` and `9.375%` in `#chart .seconds`.
- **Swipe to delete:** `OPEN` (80 px) is the Delete button's width in `.row-delete`; the 200 ms wait before a long-swipe delete is the rows' transition.
- **Segments:** the highlight's width in `.segments .thumb` is divided by the number of segments in `index.html` (now 2).
- **Screen slides:** `DEPTH` in `app.js` decides the direction (deeper slides in from the right); the keyframes are in `style.css`. A new screen needs a depth.

Shared sizes live in tokens, not per element: `--row` is the height of every row-shaped thing (list rows, tile headers, the segments, full-width buttons); every box is a `.tile`, with an extra class for its kind (`stat`, `day`, `setting`). Every screen starts with a `<header class="topbar">` (`--topbar` high: an optional `.icon-button` left, the `h1`, an optional `.icon-button` right; the columns follow from the order, so a new screen only writes the markup); every tappable icon is an `.icon-button` (`--tap` square, 20 px icon, 24 on the camera). Don't position icons one by one again.

Touch traps: a sideways gesture needs `touch-action: pan-y` on the row so up and down still scroll, and swipe or scroll is decided on the first 8 px of movement. Respect `prefers-reduced-motion` for anything that moves.

## Test data

Give the maker console snippets that write `handstand.attempts` in localStorage, and always keep a one-time backup (`handstand.attempts.backup`) plus a restore snippet. Real data: `data/load-real-data.js` loads the newest export in `data/` (by the date in its name) when pasted on localhost.
