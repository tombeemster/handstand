# Handstand: design

The look and the rules behind it, in the section order of the DESIGN.md format (Motion and Icons are extra, between Components and Do's and Don'ts). The values live in `css/tokens.css` and are not repeated here; this file says what they mean. What the app does, and why, is in `product.md`.

## Overview

Dark, calm and restrained: a few tiles on a near-black page, no decoration. The athlete's numbers are the only thing that stands out.

## Colors

Colour has a meaning.

- **Gold (`--color-gold`):** records (the record tile, the record line and dot in the chart, record rows in the lists, the timer right after a new record) and a switch that is on.
- **White (`--color-text`):** values (the daily high, the average) and the active segment.
- **Dim grey (`--color-dim`):** labels, segments not on view, axis text.
- **Amber (`--color-wait`) is for "not ready":** the skeleton when part of her is out of frame, the alert icon when the frame rate is too low.
- **Red (`--color-error`) is for what went wrong or can't be undone:** deleting (the Delete all attempts and Clear buttons, a row's swipe-to-delete), a row that wasn't timed, and what to avoid in the welcome drawings.
- **REC red (`--color-rec`):** only the Record button on home, deeper than `--color-error` so it reads as a camera button, not a warning.
- **Skeleton on the camera:** dim until she's been seen standing, then green (`--color-ready`) when she's framed and ready, amber when part of her is out of frame, faint grey for poses the app ignores.
- A value and its chart line share one colour through a `series-*` class (`series-record`, `series-best`, `series-avg`), so a tile and its line can't drift apart.

## Typography

- **Inter.** Headings small, uppercase and letter-spaced; times in tabular figures so digits don't jump.
- A plain ladder from `--font-size-100` to `--font-size-500`, plus `--font-size-display` for the timer. Text fields stay at 16 px or more so iPhone doesn't zoom in on them.

## Layout

- **One length scale** for spacing, corners and icon sizes: each 100 is 4 px (`--space-200` is 8 px, `--space-400` 16 px, `--radius-200` 8 px, `--size-icon-600` 24 px). The number states the size, so a different size is a new token, never an edited one.
- **Names:** every token in `:root` starts with what it is, then what it is for: `--color-`, `--space-`, `--size-`, `--radius-`, `--shadow-`, `--font-size-`, `--duration-`, `--ease-`. Room kept clear for something is a space (`--space-safe-top`, `--space-safe-button-record`), a fixed dimension is a size (`--size-row`, `--size-topbar`, `--size-tap`, `--size-button-record`). Variables set on one element (`--series`, `--dx`, `--at`) are local and have no prefix.
- **Tiles:** every box is a `.tile` (background, radius, shadow, 8 px apart); an extra class says what kind: `stat` (Record, Average), `day` (a day's attempts), `setting` (a name, an optional control, a description). The chart is a tile too. Lists live inside their tile, never on the page background.
- **No tab bar.** Home has one Record button fixed at the bottom and a profile icon top right. Record and Profile close with a cross top right; pages below Profile go back with an arrow top left. Profile is titled with her name once set, and has two segments: Attempts (one tile per day with its 3 longest attempts) and Settings (the summary with her editable name on top, then the settings). A day's page lists all of a day's attempts, longest first. (A tab bar for Home, Record and Log was used until 31 October; a grid of small day tiles was tried and dropped.)
- **Top bar:** every screen starts with the same one (`.topbar`, `--size-topbar`): an icon button on the left (back, or the debug toggle on the camera), the title centred, an icon button on the right (the profile on home, the cross on the camera). Each side is optional; everything is centred vertically and a long title is cut off.
- **Record screen:** the camera fills the whole screen. Text on the camera sits on a dark see-through backing; the timer is big and centred; the debug toggle is top left, the cross top right; a bottom bar mirrors the top bar: mute on the left, camera flip on the right, the lens choice (back camera) centred between them; the timer sits just above it.

## Elevation & Depth

- Tiles are the raised thing: one shadow, `--shadow-tile` (a faint drop, a light top edge and a hairline edge all round).
- On the camera, text sits on a dark see-through backing (`--color-scrim`, `--color-scrim-strong`); icons and the timer carry a black shadow, so any picture behind them is fine.
- The REC button is the one skeuomorphic element: a pill with a red domed button in a recess and the letters REC, drawn like a camera's.

## Shapes

Small things (tags, the share picture) use `--radius-100`; tiles, buttons and dialogs `--radius-tile`; pills and the switch `--radius-pill`; round buttons are circles.

## Components

Reuse these before writing a new rule; never style something that already exists by its id. Markup the app builds itself (list rows, the swipe-to-delete button, the share row) gets these looks from selector groups in the css files, not from classes.

- **`.tile`:** the box everything sits in (see Layout).
- **`.topbar`** and **`.icon-button`:** the top bar, and a 48 px tap area around an icon.
- **`.icon`:** a line icon: no fill, a 2-unit stroke, round ends, 1em unless sized; its colour is its stroke.
- **`.row`:** a fixed-height row (`--size-row`) with its contents centred. List rows, tile titles and the record's share button are rows.
- **`.button-wide`:** a full-width button, a row tall, on a tile's shadow. Add **`.button-danger`** for red text when it can't be undone.
- **`.link`:** an inline link: underlined, in the text colour.
- **Tags** in a row: the current record has a gold "record" tag; in the log and on a day's page, earlier records have the same tag in dim; "manual" attempts a dim tag; rows that weren't timed a red tag with the reason.
- **Switch:** a checkbox drawn as a track with a knob, the same on every browser; gold when on.
- **Segments:** one pill with the segment on view filled; the highlight slides to the segment tapped.

### Chart

- **Solid line with a fading area:** each practice day's high joined straight to the next practice day's, 7 days on screen with today on the right; swipe for the weeks back to her first attempt.
- **Dashed, without an area:** only from the last practice day to today, carrying that value on. It says nothing newer has been logged, and it's gone as soon as she practises again. Rows for days without attempts in Best attempts stay empty.
- **Straight across:** all-time values, both solid: the record in gold, the average in white at half opacity, quieter than the record. Tapping the Record or Average tile makes its line flicker 3 times, to show which line is which.
- **One record dot, at most:** on the day the current record was set, where the daily line meets the record line.
- **Y axis:** whole even seconds, at most 8 faint gridlines.

### Share picture

Made on the phone from the Record tile as on home, with "by" and her name if set; the app's name above it, the date below, and "manually timed" if the time was tapped. It is shown before sharing, over a dark page, with a cross top right and Share under it.

### Welcome

An intro and three slides on first opening an empty app, and from Settings (Welcome tutorial, a tile with a short description under its title): set up the phone, give it a clear view, it stays on this phone. One tile per slide, swiped sideways, with dots and a Next button. The drawings use the icons' lines: gold is her, red what to avoid, dim what only places things.

## Motion

- **Screens slide:** the camera rises from the bottom and drops back down; the profile comes down from the top and goes back up; a page below the profile (a day's page, privacy) slides in from the right and back out to the right. `--duration-screen`, no fades.
- **Segments:** the highlight slides to the segment tapped.
- **Reduced motion:** nothing slides (app.js skips the transition), and the switch, the segment highlight and the bobbing arrow stand still. A tap on Record or Average still flickers its line: that is the answer to the tap.

## Icons

Lucide: no fill, 2-unit stroke, round ends and joins. 24 px for icon buttons on the camera view, 20 px in the top bar of the other screens; 1em next to text.

## Do's and Don'ts

- Use the tokens. A new size or colour is a new token, never a hard-coded value.
- Reuse a component before writing a rule, and never style an existing thing by its id.
- Gold means a record (and a switch that is on), red means it went wrong or can't be undone, and REC red belongs to the Record button alone.
- Keep lists inside their tile, never on the page background.
- No tab bar, no grid of small day tiles: both were tried and dropped.
- Screens slide, they never fade.
- Never show the skeleton as ready (green) before she has been seen standing.
- Renaming a token that JS reads means editing the JS too: app.js reads `--color-dim`, `--color-wait`, `--color-ready`, `--size-button-row-delete` and `--duration-fast` by name, and share.js reads its colours by name.