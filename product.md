# Handstand

A phone web app that times handstands hands-free with the camera and keeps a log, so nobody has to work a stopwatch and a child can see her progress.

## Who it's for

One athlete (a child) and one operator (a parent), at home, most days. The phone stands in a tripod 2–4 m away, filming her whole body. Sessions last 5–10 minutes, with up to 50 attempts.

## Core loop

Tap **Record** on home → she kicks up → the timer starts by itself and counts → she lands → the attempt is logged, a level chime plays and the time is spoken ("4 punt 8"). **Home** shows the record, the average and a chart of daily highs (the last 7 days, swipe back for earlier weeks); The icon top right opens **Profile**: Settings (her name, a summary, the settings) and All attempts (every day; a day's page is where attempts are deleted).

## Principles

These decide every feature.

1. **Hands-free and honest.** The timer starts and stops by itself, and only a real handstand counts: kicked up from standing, upside down, steady. A missed handstand is bad; a counted hack (headstand, sitting kick) is worse.
2. **Evidence over guesses.** Every detection rule is measured on real recordings before it ships, and rules that were tried and dropped stay recorded, so nobody tries them again.
3. **Private by design.** The camera is analysed on the phone and never recorded or uploaded. The log and her name live on the phone. No accounts. The only thing that may leave the phone is an anonymous summary per session, and only if the parent turns that on.
4. **Light and simple.** A static site: plain HTML, CSS and JavaScript, no build step, no framework. It has to run smoothly on an iPhone.
5. **Motivating, not busy.** Records stand out in gold, feedback is sound and voice, and the screens stay calm: no tab bar, one Record button, a few tiles, one chart.

## Scope

**In:** automatic timing; manual timing by tapping the timer (a fallback, and for testing sounds), left out of the stats unless a setting counts it; a log with CSV export, and CSV import on an empty log (to move to a new phone); deleting on a day's page (swipe a row, a long swipe for instant, or the whole day) and deleting everything from the log; empty states before the first attempt; record and average tiles, a tap on either flickers its line in the chart; a chart of daily highs (7 days on screen, swipe back to the first attempt; dashed from the last practice day to today); level chimes plus the spoken time; an error sound and "Not timed" right after a near miss, so she can go again; a warning when the frame rate is too low to time reliably; front/back camera, 0.5×/1× lens, mute; a Profile with her name (typed in by the parent), a summary (attempts, record, average) and the settings; an opt-in switch for sharing anonymous session totals, with a privacy page that shows exactly what is sent; sharing her record as a picture; sliding screen transitions.

**Out, for now:** multiple athletes, accounts or sync, form scoring, storing video, the App Store (no Mac available), offline caching.

## Decisions

- **No salute to lock on.** It was forgotten too often, and every attempt before it was lost. The first person seen is the athlete.
- **Sounds are files, not code.** A file named `NNs-….mp3` in `sounds/` is a chime for holds longer than NN seconds; several with the same NN are variants, played at random without repeating. For now only 1 s has variants (four); the other levels are settled with one chime each. A file starting with `error` is the not-timed sound.
- **Dutch voice:** female where available, one decimal, "punt" for the decimal point, no "seconden".
- **Manual timing doesn't count by default.** A tapped time can be anything, so it stays out of the record, average and chart, and never sets a record, unless "Count manual timing in averages and records" is on (Profile page). It's always logged, labelled "manual".
- **Log on the phone only** (localStorage). The CSV export is the backup.
- **No tab bar** (since 31 October). Home is the start: a REC button at the bottom opens the camera, a cross closes it; the profile icon opens Settings, the Daily highs tile opens All attempts. Fewer controls on screen, and the camera is one obvious tap away. Every screen has the same top bar (back or a tool on the left, the title, an action on the right), and every icon has a 48 px tap area: the app is used with one hand, often from across the room in a hurry.
- **Analytics are opt-in and anonymous.** Off by default (testers are asked to turn it on). A summary per session: counts and times, the date, the app version; no name, no ids of any kind, no time of day. `summary.js` builds it, and the privacy page shows it, so what is promised and what is sent can't drift apart.
- **A session ends when she stops using the camera.** Leaving the record screen, locking the phone or going to another app ends it at once and sends its summary (iPhone doesn't reliably say when an app is closed, but it does say when it goes out of view); coming back starts on home. An attempt still running then is dropped, not logged. With the phone left on, 2 minutes without an attempt, near miss or tap do the same.
- **Sharing a record is a deliberate tap.** Tapping the record's row in the Profile summary (it has a forward icon) makes a picture on the phone (the Record tile as on home, with "by" and her name if set; the app's name above it, the date below) and opens the share sheet; the app stores and sends nothing. No prompt after a new record, no text alongside: the picture stands on its own.
- **Her name stays on the phone** unless a record is shared with it. It titles the Profile and is never in the analytics; until it's set, the field suggests "Simone Biles".
- **Deleting happens in one place:** a day's page. The log's day tiles only show; tapping a row there used to delete it. A long swipe deletes without asking (the gesture is the confirmation); a whole day or the whole log asks first.
- **A fall can't keep the timer going.** Falling and kicking straight back up used to continue the attempt; now an attempt only continues after a brief misread (a quick restart, or the feet never near the floor), and every kick-up must start from standing. Measured on hack.MOV and all other recordings: only the hack changed.
- **Thursday 29 October is the detection baseline.** Asking the camera for 30 fps, and logging an attempt still running when leaving the Record tab, were tried on 30 October and undone: that day more handstands went untimed and counts appeared that never happened.

## Next

- Use the near-miss log from live sessions to find the attempts that still go untimed.
- One session on the baseline with the debug box open: note the fps standing and with arms up. Then one with only the upside-down second opinion off, same place and light. Frame rate is the biggest lever the bake-off found (lite at 30 fps timed 59 of 60 attempts, at 15 fps 44).
- v1 for the tester round (see the v1 requirements doc): the privacy page's retention period and contact, bump `APP_VERSION` in `summary.js`.
