# Handstand

A phone web app that times handstands hands-free with the camera and keeps a log, so nobody has to work a stopwatch and a child can see her progress.

## Who it's for

One athlete (a child) and one operator (a parent), at home, most days. The phone stands in a tripod 2–4 m away, filming her whole body. Sessions usually last 5–10 minutes, with up to 100 attempts.

## Core loop

Tap **Record** on home → she kicks up → the timer starts by itself and counts → she lands → the attempt is logged, a level chime plays and the time is spoken ("4 punt 8"). **Home** shows the record, the average and a chart of daily highs; the icon top right opens **Profile**: Settings (her name, a summary, the settings) and Attempts (every day; a day's page is where attempts are deleted).

## Principles

These decide every feature.

1. **Hands-free and honest.** The timer starts and stops by itself, and only a real handstand counts: kicked up from standing, upside down, steady. A missed handstand is bad; a counted hack (headstand, sitting kick) is worse.
2. **Evidence over guesses.** Every detection rule is measured on real recordings before it ships, and rules that were tried and dropped stay recorded, so nobody tries them again.
3. **Private by design.** The camera is analysed on the phone and never recorded or uploaded. The log and the athlete's name live on the phone (the name only leaves in a record picture the parent chooses to share, never in the analytics). No accounts. The only thing that may leave the phone is an anonymous summary per session, and only if the parent turns that on.
4. **Light and simple.** A static site: plain HTML, CSS and JavaScript, no build step, no framework. It has to run smoothly on an iPhone.
5. **Motivating, not busy.** Records stand out in gold, feedback is sound and voice, and the screens stay calm: no tab bar, one Record button, a few tiles, one chart.

## Scope

**In:** automatic timing; manual timing by tapping the timer (a fallback, and for testing sounds), left out of the stats unless a setting counts it; a log with CSV export, and CSV import on an empty log (to move to a new phone); deleting on a day's page (swipe a row, a long swipe for instant, or the whole day) and deleting everything from the log; empty states before the first attempt; record and average tiles and a chart of daily highs, tied together (how: design.md); level chimes plus the spoken time; an error sound and "Not timed" right after a near miss, so she can go again, and a log of what wasn't timed with its reason; a warning when the frame rate is too low to time reliably; front/back camera, 0.5×/1× lens, mute; a Profile with her name (typed in by the parent), a summary (attempts, record, average) and the settings; an opt-in switch for sharing anonymous session totals, with a privacy page that shows exactly what is sent; sharing her record as a picture; a short welcome on first use, for what the screens can't explain (an intro and three slides: where to put the phone, what helps the tracking, what stays private), reopened from the settings (Welcome tutorial); sliding screen transitions.

**Known limit:** swiping the app away very quickly after switching apps can lose that session's summary. Accepted: the row count runs slightly low, no wrong numbers get stored.

**Out, for now:** multiple athletes, accounts or sync, form scoring, storing video, the App Store (no Mac available), offline caching.

## Decisions

- **Sounds are files, not code.** Chimes and the not-timed sound are dropped into `sounds/`; the naming is in SKILL.md.
- **Dutch voice:** female where available, one decimal, "punt" for the decimal point, no "seconden".
- **Manual timing doesn't count by default.** A tapped time can be anything, so it stays out of the record, average and chart, and never sets a record, unless the "Manual timing" setting is on. It's always logged, labelled "manual".
- **What isn't timed is logged too, apart from the attempts.** Near misses and attempts under 1 s are kept on the phone with their reason and counted in the summary; they never touch the record, the average or the chart. They mean "the app saw something and didn't count it": a headstand shows up here too. The analytics send the near misses per reason, to show which rule costs the most attempts.
- **No tab bar.** Home is the start, with one REC button that opens the camera: fewer controls on screen, and the camera is one obvious tap away. Every icon has a 48 px tap area: the app is used with one hand, often from across the room in a hurry. (Layout: design.md.)
- **Analytics are opt-in and anonymous.** Off by default (testers are asked to turn it on). What is sent is what the privacy page shows: `summary.js` builds both, so what is promised and what is sent can't drift apart.
- **A session ends when she stops using the camera.** Leaving the record screen, locking the phone or going to another app ends it at once and sends its summary (iPhone doesn't reliably say when an app is closed, but it does say when it goes out of view); an attempt still running then is dropped, not logged. With the phone left on, 3 minutes without an attempt, near miss or tap do the same.
- **Sharing a record is a deliberate tap.** Tapping the record's row in the Profile summary makes a picture on the phone and shows it; Share opens the share sheet. The app stores and sends nothing, there is no prompt after a new record and no text alongside: the picture stands on its own. (What it shows: design.md.)
- **Deleting happens in one place:** a day's page, for attempts and not-timed rows alike. The log's day tiles only show. A long swipe deletes without asking (the gesture is the confirmation); a whole day or the whole log asks first.

## Next

- **After the test:** catch a handstand resting on the head (`IMG_2320`, `IMG_2322`, `IMG_2323`: arms bent, head on the mat, timed up to 6.8 s). Measured on 69 attempts: the head level with the hands and one arm under 120° for 500 ms catches all 3 timed ones and no others, at 30 and 15 fps; arm stretch alone doesn't separate them. First record it in other clothes, a real bent-arm handstand with the head clear, and one that slowly sinks. Testers are asked to be honest about this one for now.
- Use the near-miss counts per reason from live sessions (Supabase, and the rows on a day's page) to find which rule costs the most attempts, and the silent misses that still leave no trace.
- One session on the baseline (see SKILL.md) with the debug box open: note the fps standing and with arms up. Then one with only the upside-down second opinion off, same place and light. Frame rate is the biggest lever the bake-off found (lite at 30 fps timed 59 of 60 attempts, at 15 fps 44).
- v1 for the tester round (see the v1 requirements doc): the privacy page's retention period and contact, bump `APP_VERSION` in `summary.js`.