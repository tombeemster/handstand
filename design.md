# Handstand: design

The look and the rules behind it. The values (colours, spacing, sizes) live in `style.css` (`:root`); this file says what they mean. Use the tokens, never a new hard-coded value.

## Character

Dark, calm and restrained: a few tiles on a near-black page, no decoration. The athlete's numbers are the only thing that stands out.

## Colour has a meaning

- **Gold is for records only:** the record tile, the record line and dot in the chart, record rows in the lists, the timer right after a new record. Nothing else is gold, so gold always means "record".
- **White:** values (the daily high, the average) and the active tab.
- **Dim grey:** labels, inactive tabs, axis text.
- **Skeleton on the camera:** green when she's framed and ready, amber when part of her is out of frame, faint grey for poses the app ignores.
- A value and its chart line share one colour through a `series-*` class (`series-record`, `series-best`, `series-avg`), so a tile and its line can't drift apart.

## Chart

- **Solid line with a fading area:** each day's high, the last 7 days, today on the right. A day without attempts carries the previous value flat.
- **Dashed lines:** all-time values, the record (gold) and the average (white).
- **One record dot, at most:** on the day the current record was set, where the daily line meets the record line. The same dot marks the current record in every list.
- **Y axis:** whole even seconds, at most 8 faint gridlines.

## Type and layout

- **Vend Sans.** Headings small, uppercase and letter-spaced; times in tabular figures so digits don't jump.
- **Tiles** with the shared tile shadow, 8 px apart. Lists live inside their tile, never on the page background.
- **Three tabs** in a floating pill: Home, Record, Log. Log = one tile per day with its 3 longest attempts; a day's page lists all of them, longest first. (A grid of small day tiles was tried and dropped.)
- **Record screen:** the camera fills the whole screen, behind the tab bar. Text on the camera sits on a dark see-through backing; the timer is big and centred; mute and camera flip are tab-sized buttons on either side of the bar.

## Icons

Lucide: no fill, 2-unit stroke, round ends and joins. 24 px in the tab bar and beside it; 1em next to text.
