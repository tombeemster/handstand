# Handstand

A phone web app that times handstands hands-free with the camera and keeps a log, so nobody has to work a stopwatch and a child can see her progress.

## Who it's for

One athlete (a child) and one operator (a parent), at home, most days. The phone stands in a tripod 2–4 m away, filming her whole body. Sessions last 5–10 minutes, with up to 50 attempts.

## Core loop

Open the **Record** tab → she kicks up → the timer starts by itself and counts → she lands → the attempt is logged, a level chime plays and the time is spoken ("4 punt 8"). **Home** shows the record, the average and the last 7 days; **Log** shows every day.

## Principles

These decide every feature.

1. **Hands-free and honest.** The timer starts and stops by itself, and only a real handstand counts: kicked up from standing, upside down, steady. A missed handstand is bad; a counted hack (headstand, sitting kick) is worse.
2. **Evidence over guesses.** Every detection rule is measured on real recordings before it ships, and rules that were tried and dropped stay recorded, so nobody tries them again.
3. **Private by design.** The camera is analysed on the phone and never recorded or uploaded. The log lives on the phone. No accounts, no backend, no analytics.
4. **Light and simple.** A static site: plain HTML, CSS and JavaScript, no build step, no framework. It has to run smoothly on an iPhone.
5. **Motivating, not busy.** Records stand out (gold is for records only), feedback is sound and voice, and the screens stay calm: three tabs, a few tiles, one chart.

## Scope

**In:** automatic timing; manual timing by tapping the timer (a fallback, and for testing sounds); a log with delete and CSV export; record and average tiles; a 7-day chart of daily highs; level chimes plus the spoken time; front/back camera, 0.5×/1× lens, mute.

**Out, for now:** multiple athletes, accounts or sync, form scoring, storing video, the App Store (no Mac available), offline caching.

## Decisions

- **No salute to lock on.** It was forgotten too often, and every attempt before it was lost. The first person seen is the athlete.
- **Sounds are files, not code.** A file named `NNs-….mp3` in `sounds/` is a chime for holds longer than NN seconds; several with the same NN are variants, played at random without repeating. For now only 1 s has variants (four); the other levels are settled with one chime each.
- **Dutch voice:** female where available, one decimal, "punt" for the decimal point, no "seconden".
- **Log on the phone only** (localStorage). The CSV export is the backup.

## Next

- Use the near-miss log from live sessions to find the attempts that still go untimed.
