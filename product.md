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
3. **Private by design.** The camera is analysed on the phone and never recorded or uploaded. The log and the athlete's name live on the phone. No accounts. The only thing that may leave the phone is an anonymous summary per session, and only if the parent turns that on.
4. **Light and simple.** A static site: plain HTML, CSS and JavaScript, no build step, no framework. It has to run smoothly on an iPhone.
5. **Motivating, not busy.** Records stand out in gold, feedback is sound and voice, and the screens stay calm: no tab bar, one Record button, a few tiles, one chart.

## Scope

**In:** automatic timing; manual timing by tapping the timer (a fallback, and for testing sounds), left out of the stats unless a setting counts it; a log with CSV export, and CSV import on an empty log (to move to a new phone); deleting on a day's page (swipe a row, a long swipe for instant, or the whole day) and deleting everything from the log; empty states before the first attempt; record and average tiles, a tap on either flickers its line in the chart; a chart of daily highs (7 days on screen, swipe back to the first attempt; dashed from the last practice day to today); level chimes plus the spoken time; an error sound and "Not timed" right after a near miss, so she can go again, and a log of what wasn't timed with its reason; a warning when the frame rate is too low to time reliably; front/back camera, 0.5×/1× lens, mute; a Profile with her name (typed in by the parent), a summary (attempts, record, average) and the settings; an opt-in switch for sharing anonymous session totals, with a privacy page that shows exactly what is sent; sharing her record as a picture; a three-slide welcome on first use, reopened from the settings; sliding screen transitions.

**Known limit:** swiping the app away very quickly after switching apps can lose that session's summary. Accepted: the row count runs slightly low, no wrong numbers get stored.

**Out, for now:** multiple athletes, accounts or sync, form scoring, storing video, the App Store (no Mac available), offline caching.

## Decisions

- **No salute to lock on.** It was forgotten too often, and every attempt before it was lost. The first person seen is the athlete.
- **Sounds are files, not code.** A file named `NNs-….mp3` in `sounds/` is a chime for holds longer than NN seconds; several with the same NN are variants, played at random without repeating. For now only 1 s has variants (four); the other levels are settled with one chime each. A file starting with `error` is the not-timed sound.
- **Dutch voice:** female where available, one decimal, "punt" for the decimal point, no "seconden".
- **Manual timing doesn't count by default.** A tapped time can be anything, so it stays out of the record, average and chart, and never sets a record, unless "Count manual timing in averages and records" is on (Profile page). It's always logged, labelled "manual".
- **What isn't timed is logged too, apart from the attempts.** Near misses and attempts under 1 s are kept on the phone with their reason, shown on a day's page (swipe a row to delete it) and counted in the summary; they never touch the record, the average or the chart. Export includes them as rows of their own, and Import reads them back. They mean "the app saw something and didn't count it": a headstand shows up here too. The analytics send the near misses per reason, to show which rule costs the most attempts.
- **Log on the phone only** (localStorage). The CSV export is the backup.
- **No tab bar** (since 31 October). Home is the start: a REC button at the bottom opens the camera, a cross closes it; the profile icon opens Settings, a cross closes that too, the Daily highs tile opens All attempts. Fewer controls on screen, and the camera is one obvious tap away. Every screen has the same top bar (back or a tool on the left, the title, an action on the right), and every icon has a 48 px tap area: the app is used with one hand, often from across the room in a hurry.
- **Analytics are opt-in and anonymous.** Off by default (testers are asked to turn it on). A summary per session: counts (near misses per reason too) and times, the date, the app version; no name, no ids of any kind, no time of day. `summary.js` builds it, and the privacy page shows it, so what is promised and what is sent can't drift apart.
- **A session ends when she stops using the camera.** Leaving the record screen, locking the phone or going to another app ends it at once and sends its summary (iPhone doesn't reliably say when an app is closed, but it does say when it goes out of view); coming back starts on home. An attempt still running then is dropped, not logged. With the phone left on, 2 minutes without an attempt, near miss or tap do the same.
- **Sharing a record is a deliberate tap.** Tapping the record's row in the Profile summary (it has a forward icon) makes a picture on the phone (the Record tile as on home, with "by" and her name if set; the app's name above it, the date below), shows it, and Share opens the share sheet; the app stores and sends nothing. No prompt after a new record, no text alongside: the picture stands on its own.
- **A welcome for what the screens can't explain:** where to put the phone, what helps the tracking, and what stays private; the sharing switch sits on its last slide. An app already in use doesn't get it, but anyone can reopen it from the settings.
- **Her name stays on the phone** unless a record is shared with it. It titles the Profile and is never in the analytics; until it's set, the field suggests "Simone Biles".
- **Records are tagged in the lists.** The current record has a gold "record" tag, earlier records on the log and a day's page the same tag in dim; manual attempts a "manual" tag, not-timed rows a red tag with the reason (`under 1s`, `not seen standing`, `not vertical`, `not steady`, `lock-on issue`). One wording everywhere: on screen, in the export and in the debug box.
- **Deleting happens in one place:** a day's page, for attempts and not-timed rows alike. The log's day tiles only show; tapping a row there used to delete it. A long swipe deletes without asking (the gesture is the confirmation); a whole day or the whole log asks first.
- **A fall can't keep the timer going.** Falling and kicking straight back up used to continue the attempt; now an attempt only continues after a brief misread (a quick restart, or the feet never near the floor), and every kick-up must start from standing. Measured on hack.MOV and all other recordings: only the hack changed.
- **Thursday 29 October is the detection baseline.** Asking the camera for 30 fps, and logging an attempt still running when leaving the Record tab, were tried on 30 October and undone: that day more handstands went untimed and counts appeared that never happened.

## Next

- **After the test:** catch a handstand resting on the head (`IMG_2320`, `IMG_2322`, `IMG_2323`: arms bent, head on the mat, timed up to 6.8 s). Measured on 69 attempts: the head level with the hands and one arm under 120° for 500 ms catches all 3 timed ones and no others, at 30 and 15 fps; arm stretch alone doesn't separate them. First record it in other clothes, a real bent-arm handstand with the head clear, and one that slowly sinks. Testers are asked to be honest about this one for now.
- Use the near-miss counts per reason from live sessions (Supabase, and the rows on a day's page) to find which rule costs the most attempts, and the silent misses that still leave no trace.
- One session on the baseline with the debug box open: note the fps standing and with arms up. Then one with only the upside-down second opinion off, same place and light. Frame rate is the biggest lever the bake-off found (lite at 30 fps timed 59 of 60 attempts, at 15 fps 44).
- v1 for the tester round (see the v1 requirements doc): the privacy page's retention period and contact, bump `APP_VERSION` in `summary.js`.
