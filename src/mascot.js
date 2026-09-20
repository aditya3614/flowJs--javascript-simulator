/**
 * The mascot, drawn as a pixel grid — the single source of truth for both the
 * logo in the header and the favicon (`npm run favicon` regenerates that from
 * this file, so the two cannot drift apart).
 *
 *   #  body (takes the gradient)
 *   d  deeper red — antenna tip, belly band, feet
 *   e  eye                    .  empty
 */
export const MASCOT = {
  size: 12,
  rows: [
    '.....dd.....',
    '.....##.....',
    '..########..',
    '.##########.',
    '.##########.',
    '.##ee##ee##.',
    '.##ee##ee##.',
    '############',   // the arms: one pixel of it sticks out each side
    '.##########.',
    '..dddddddd..',
    '...dd..dd...',
    '...dd..dd...',
  ],

  /*
   * Bright coral-red at the antenna, easing down to a strong red where the belly
   * band begins. Laid slightly on the diagonal so the light seems to come from
   * the upper left. It stops at the body's own red so the deeper band and feet
   * below still read as a separate, darker tone.
   */
  gradient: {
    x1: 2, y1: 1, x2: 10, y2: 9,
    stops: [[0, '#F77B6E'], [0.5, '#E4483F'], [1, '#CC322B']],
  },
  fills: { d: '#A32320', e: '#141413' },
};

export const GRADIENT_ID = 'mascot-gradient';

/** Horizontal runs of one symbol per row — fewer shapes than one per pixel. */
export function mascotRects() {
  const out = [];
  MASCOT.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x += 1; continue; }
      let w = 1;
      while (row[x + w] === ch) w += 1;
      out.push({ x, y, w, ch });
      x += w;
    }
  });
  return out;
}

/** The <linearGradient> element as markup, for the standalone favicon. */
export function gradientMarkup() {
  const g = MASCOT.gradient;
  const stops = g.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  return `<linearGradient id="${GRADIENT_ID}" gradientUnits="userSpaceOnUse" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">${stops}</linearGradient>`;
}
