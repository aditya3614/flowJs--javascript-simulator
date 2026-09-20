/**
 * Writes public/favicon.svg from the mascot grid in src/mascot.js.
 * Run with: npm run favicon
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { MASCOT, GRADIENT_ID, mascotRects, gradientMarkup } from '../src/mascot.js';

const fillFor = (ch) => (ch === '#' ? `url(#${GRADIENT_ID})` : MASCOT.fills[ch]);

const rects = mascotRects()
  .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${fillFor(r.ch)}"/>`)
  .join('');

const n = MASCOT.size;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><defs>${gradientMarkup()}</defs>${rects}</svg>\n`;

mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/favicon.svg', import.meta.url), svg);
console.log(`wrote public/favicon.svg (${svg.length} bytes)`);
