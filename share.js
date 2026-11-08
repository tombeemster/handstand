// The record as a picture to share: a square PNG, drawn on the phone, sent nowhere by the app. The Record
// tile as on home in the middle, with "by [her name]" in it if set; the app's name above it, the date
// below it. Colours come from the css/tokens.css tokens.

const SIZE = 1080, MARGIN = 80;
const LINE = 1.2;   // line height
// The tile: home's Record tile at SCALE times its size (.stat, .stat b, --radius-tile, --shadow-tile)
const SCALE = 6, VALUE = 24 * SCALE, PAD = 18 * SCALE, RADIUS = 8 * SCALE, EDGE = 3;
const MANUAL = 38;   // "manually timed", under the date, when the record was tapped
const BY = 56, OUTSIDE = 44, GAP = 48;   // "by [name]"; the lines above and below the tile, and their distance
const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const font = (weight, size) => `${weight} ${size}px Inter, system-ui, sans-serif`;

// The size at which text fits the room: smaller if needed (a long name, a long time)
function fit(g, text, size, weight, room) {
  do g.font = font(weight, size);
  while (g.measureText(text).width > room && (size -= 4) > 20);
  return size;
}

// A Promise of the PNG, as a Blob. name: her name, or '' for none; manual: the record was timed by tapping.
export async function recordCard({ time, date, name, manual }) {
  // canvas text only uses a font that has already loaded; without it, the system font
  await Promise.all(['500 40px Inter', '400 40px Inter', 'italic 400 40px Inter'].map(f => document.fonts.load(f))).catch(() => {});
  const canvas = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE });
  const g = canvas.getContext('2d');
  g.fillStyle = token('--color-bg');
  g.fillRect(0, 0, SIZE, SIZE);
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  const room = SIZE - 2 * MARGIN - 2 * PAD;   // for the text inside the tile
  const by = name ? `by ${name}` : '';
  const valueSize = fit(g, time, VALUE, 400, room);
  const valueWidth = g.measureText(time).width;
  const bySize = by ? fit(g, by, BY, 400, room) : 0;
  const byWidth = by ? g.measureText(by).width : 0;
  const labelSize = bySize || BY;   // "Record" as big as "by [name]"
  g.font = font(400, labelSize);
  const tileWidth = Math.max(g.measureText('Record').width, valueWidth, byWidth) + 2 * PAD;
  const tileHeight = 2 * PAD + (labelSize + valueSize + bySize) * LINE;

  // the tile in the very middle of the picture; above and below it, at the same distance, one line each
  const x = (SIZE - tileWidth) / 2, top = (SIZE - tileHeight) / 2;
  const line = (text, weight, size, colour, y) => {
    g.font = font(weight, size);
    g.fillStyle = colour;
    g.fillText(text, SIZE / 2, y);
  };
  line('Handstand', 500, OUTSIDE, token('--color-dim'), top - GAP - OUTSIDE * LINE / 2);
  const dateY = top + tileHeight + GAP + OUTSIDE * LINE / 2;
  line(date, 400, OUTSIDE, token('--color-dim'), dateY);
  if (manual) line('manually timed', 'italic 400', MANUAL, token('--color-dim'), dateY + OUTSIDE * LINE / 2 + 16 + MANUAL * LINE / 2);

  // the tile: its background, the faint edge all round and the lighter top edge of --shadow-tile
  g.save();
  g.beginPath();
  g.roundRect(x, top, tileWidth, tileHeight, RADIUS);
  g.fillStyle = token('--color-tile');
  g.fill();
  g.clip();
  g.fillStyle = 'rgba(255, 255, 255, 0.06)';
  g.fillRect(x, top, tileWidth, EDGE);
  g.strokeStyle = token('--color-tile-edge-light');
  g.lineWidth = 2 * EDGE;   // half of it falls outside the clip
  g.beginPath();
  g.roundRect(x, top, tileWidth, tileHeight, RADIUS);
  g.stroke();
  g.restore();

  // inside it: the label, the time, and who holds it
  let y = top + PAD;
  for (const [text, size, colour] of [['Record', labelSize, token('--color-dim')], [time, valueSize, token('--color-gold')], [by, bySize, token('--color-text')]]) {
    if (!text) continue;
    line(text, 400, size, colour, y + size * LINE / 2);
    y += size * LINE;
  }

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}