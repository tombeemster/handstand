# Handstand: design

The look and the rules behind it. The values (colours, spacing, sizes) live in `style.css` (`:root`); this file says what they mean. Use the tokens, never a new hard-coded value.

## Character

Dark, calm and restrained: a few tiles on a near-black page, no decoration. The athlete's numbers are the only thing that stands out.

## Colour has a meaning

- **Gold:** records (the record tile, the record line and dot in the chart, record rows in the lists, the timer right after a new record) and a switch that is on.
- **White:** values (the daily high, the average) and the active tab.
- **Dim grey:** labels, segments not on view, axis text.
- **Amber (`--wait`) is for "not ready":** the skeleton when part of her is out of frame, the alert icon when the frame rate is too low.
- **Red (`--danger`) is for deleting for good:** the Delete all attempts and Delete daily attempts buttons, and a row's swipe-to-delete.
- **REC red (`--rec`):** only the Record button on home, deeper than `--danger` so it reads as a camera button, not a warning.
- **Skeleton on the camera:** green when she's framed and ready, amber when part of her is out of frame, faint grey for poses the app ignores.
- A value and its chart line share one colour through a `series-*` class (`series-record`, `series-best`, `series-avg`), so a tile and its line can't drift apart.

## Chart

- **Solid line with a fading area:** each day's high, 7 days on screen with today on the right; swipe for the weeks back to her first attempt. A day without attempts carries the previous value flat.
- **Dashed lines:** all-time values, the record (gold) and the average (white at 0.6 opacity, quieter than the record). Tapping the Record or Average tile makes its line flicker 3 times while its dashes run, to show which line is which.
- **One record dot, at most:** on the day the current record was set, where the daily line meets the record line. The same dot marks the current record in every list.
- **Y axis:** whole even seconds, at most 8 faint gridlines.

## Type and layout

- **Vend Sans.** Headings small, uppercase and letter-spaced; times in tabular figures so digits don't jump.
- **Tiles:** every box is a `.tile` (background, radius, shadow, 8 px apart); an extra class says what kind: `stat` (Record, Average), `day` (a day's attempts), `setting` (a name, a switch, a description). The chart is a tile too. Lists live inside their tile, never on the page background.
- **No tab bar.** Home has one Record button fixed at the bottom, drawn like a camera's REC button (a red domed button in a dark recessed housing, the one skeuomorphic element) and a profile icon top right. Record closes with a cross top right. Profile has three segments: Summary, Log (one tile per day with its 3 longest attempts) and Settings. A day's page lists all of a day's attempts, longest first. (A tab bar for Home, Record and Log was used until 31 October; a grid of small day tiles was tried and dropped.)
- **Record screen:** the camera fills the whole screen. Text on the camera sits on a dark see-through backing; the timer is big and centred; the debug toggle is top left, the cross top right; mute and camera flip sit in the left and right corners, level with the timer; the lens choice is under it.

## Motion

- **Screens slide, by depth:** the camera rises from the bottom and drops back down; a deeper page (home → profile → a day's page) slides in from the right and back out to the right. 0.3 s, no fades.
- **Segments:** the highlight slides to the segment tapped.
- **Reduced motion:** nothing slides.

## Icons

Lucide: no fill, 2-unit stroke, round ends and joins. 24 px for icon buttons on the camera view, 20 px in the top bar of the other screens; 1em next to text.
