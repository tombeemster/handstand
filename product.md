# Handstand

A phone web app that times handstands hands-free with the camera and keeps a log, so nobody has to work a stopwatch and a child can see her progress.

## Register

product

## Users

One athlete (a child) and one operator (a parent), practicing at home most days. The phone stands on a tripod 2–4 m away, filming her whole body. Sessions last 5–10 minutes, with up to 50 attempts. The parent operates the phone; the child practices and follows her progress.

## Problem

The parent needs to film and supervise practice while also timing each attempt. A separate stopwatch competes for attention, and without a clear record of practice the child has less visible evidence of progress. Handstands also need to be distinguished from false starts and poses that should not count.

## Product Purpose

Handstand uses the phone camera to start and stop timing automatically, logs attempts, and presents the Record and daily highs so the child can see progress without the parent working a stopwatch.

Success means timing real handstands hands-free, not counting false starts or poses such as headstands, sitting kicks and wall handstands, and making progress understandable across practice days. Targets, from the first PRD:

- At least 9 in 10 real handstands detected from a side view, 8 in 10 from a diagonal view.
- Fewer than 1 false attempt per session.
- Durations within 0.2 s of a frame-by-frame review of a recording.
- Manual timing needed in fewer than 1 in 10 attempts.

## Brand Personality / Tone

Calm, simple, honest, and encouraging. Keep screens uncluttered; make feedback immediate with a level chime and a spoken time. Be clear when an attempt was not timed or the camera view is inadequate.

## Anti-references

- Not a fitness or social app: no streaks, feeds, comparison with other people, or scores for form.
- Not a dashboard: a few numbers, one chart, nothing that asks for attention the parent does not have.

## Design Principles

1. **Hands-free and honest.** The timer starts and stops by itself, and only a real handstand counts: kicked up from standing, upside down, steady, and not against a wall. A missed handstand is bad; a counted hack is worse.
2. **Evidence over guesses.** Measure detection rules on real recordings before shipping them, and accept a change only if it gains without losing on any clip. The process is in SKILL.md; tried-and-dropped variants are recorded in `detect.js`.
3. **Private by design.** Analyse the camera on the phone and never record or upload video. Keep the log and athlete's name on the phone. Session totals are anonymous and sent only when sharing is enabled. A summary never carries a name or other identifying detail.
4. **Light and simple.** Use a static site with plain HTML, CSS, and JavaScript; keep it smooth on a phone.
5. **Motivating, not busy.** Make records stand out in gold, give feedback with sound and voice, and keep the screens calm.

## Accessibility & Inclusion

- Make controls usable one-handed, with a 48 px tap area for every icon.
- Show the whole athlete in the camera view from a phone placed 2–4 m away; explain when the frame rate or framing is not reliable.
- Pair the result with visual feedback and a spoken time, so progress is not communicated by colour alone.

## Core Experience

Tap **Record** on Home → athlete kicks up → the timer starts by itself and counts → athlete lands → the attempt is logged, a level chime plays, and the time is spoken ("4 punt 8"). Home shows the Record, Average best, a chart of daily highs, and Daily records. Profile opens Settings (name, summary, and controls) and Attempts (the log; a day's page is where attempts are deleted).

## Capabilities

- Automatic timing, with optional manual timing as a fallback and for testing sounds. Manual attempts are always logged and labelled; whether they count is a setting (see Counted attempt in the Terminology).
- An attempts log with CSV export, import into an empty log, and deletion by attempt, day, or whole log.
- Record and Average best tiles, a chart of daily highs, and the Daily records list.
- Near misses and holds under one second are logged separately as not timed, with a reason. Session summaries count them; the Record, Average best and the chart ignore them.
- Camera controls for front/back camera and 0.5×/1× lens, mute, and a warning when frame rate is too low to time reliably.
- An optional switch for anonymous session totals, with a privacy page describing exactly what is sent.
- A record picture made on the phone and shared only when the parent chooses, plus a short first-use welcome tutorial that can be reopened in Settings.

## Boundaries

- Not in scope: multiple athletes, accounts or sync, form scoring, storing video, an App Store release, or offline caching.
- Known limit: swiping the app away very quickly after switching apps can lose that session's summary. Accepted for now; the row count may be slightly low, but no incorrect numbers should be stored.

## Product Decisions

- Average best uses daily highs, not all attempts. About half of attempts end within two seconds, so the mean of all attempts barely moves and says little about progress. A duration floor was tried and dropped because durations have no clear gap and a floor hides practice days.
- A session ends when the athlete leaves the recording screen, locks the phone, switches apps, or leaves the phone idle for three minutes. The summary is sent at that point if sharing is enabled; an attempt still running is dropped.
- Analytics are opt-out and on by default. A session summary includes counts and times, not a name, account, ID, or time of day. Nothing is queued or retried.
- The Dutch voice uses a female voice where available, one decimal place, "punt" for the decimal point, and no "seconden".
- Deletion is available on a day's page for attempts and not-timed rows. A long swipe deletes a row without asking; deleting a whole day or the whole log asks for confirmation.

## Further reading

- [Project overview, stack and commands](./README.md)
- [Terminology](./TERMINOLOGY.md): the names and definitions every file uses
- [Design and interface specification](./DESIGN.md)
- [Metrics Worker setup](./worker/README.md)