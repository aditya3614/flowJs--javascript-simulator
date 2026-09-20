/**
 * The spoken script.
 *
 * The on-screen sentence is written to be read; this turns it into something
 * to be *heard*. Symbols become words ("p < 50" → "p is less than 50"), values
 * get an article ("[1, 2]" → "a list of 1, 2"), and the first time each
 * concept appears in a run it gets one plain-English sentence of explanation.
 *
 * It is pure text-in, text-out — no browser APIs — so a different voice engine
 * (or a language model writing richer commentary) can replace the audio layer
 * without touching this.
 */

/* -------------------------------------------------------- code → words */

const camelToWords = (id) => id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();

/*
 * 0.1 + 0.2 is 0.30000000000000004 in JavaScript. That is worth *seeing*, but
 * nobody wants it read out digit by digit, so long decimals are spoken rounded.
 */
const roundLong = (s) => s.replace(/-?\d+\.\d{4,}(?:e[+-]?\d+)?/gi, (n) => String(Math.round(parseFloat(n) * 100) / 100));

const tidy = (s) => roundLong(s)
  .replace(/\s+/g, ' ')
  .replace(/\s+([,.;:!?])/g, '$1')
  .replace(/,\s*,/g, ',')
  .trim();

/** Read a snippet of code aloud: `u.name.toUpperCase()` → "u dot name dot to upper case". */
export function spokenCode(src) {
  let s = ` ${src} `;

  // Strings: say the contents, not the quote marks.
  s = s.replace(/"([^"]*)"|'([^']*)'|`([^`]*)`/g, (_, a, b, c) => a ?? b ?? c ?? '');

  // Identifiers: split camelCase so "withTax" is heard as "with tax".
  s = s.replace(/[A-Za-z_$][\w$]*/g, camelToWords);

  s = s.replace(/\(\s*\)/g, ' ');            // empty call: "toUpperCase()" → just the name
  s = s.replace(/\.\.\./g, ' spread ');
  s = s.replace(/\?\./g, ' dot ');

  // Longest operators first, so "===" is never read as "==" plus "=".
  const OPS = [
    [/===/g, ' is exactly equal to '],
    [/!==/g, ' is not equal to '],
    [/!=/g, ' is not equal to '],
    [/==/g, ' equals '],
    [/>=/g, ' is at least '],
    [/<=/g, ' is at most '],
    [/=>/g, ' gives '],
    [/&&/g, ' and '],
    [/\|\|/g, ' or '],
    [/\?\?/g, ' or, if that is empty, '],
    [/\+\+/g, ' plus one '],
    [/--/g, ' minus one '],
  ];
  OPS.forEach(([re, words]) => { s = s.replace(re, words); });

  // Property access — but never the decimal point in 1.2.
  s = s.replace(/([\w$)\]])\.(?=[A-Za-z_$])/g, '$1 dot ');

  // f(x) → "f of x"; a list literal vs. indexing depends on what precedes "[".
  s = s.replace(/([A-Za-z0-9_$])\(/g, '$1 of ');
  s = s.replace(/(\S?)\[/g, (m, prev) => (/[\w$)\]]/.test(prev) ? `${prev} at position ` : `${prev} a list of `));

  const SINGLE = [
    [/</g, ' is less than '],
    [/>/g, ' is greater than '],
    [/%/g, ' modulo '],
    [/\*/g, ' times '],
    [/\//g, ' divided by '],
    [/\+/g, ' plus '],
    [/-/g, ' minus '],
    [/!/g, ' not '],
    [/=/g, ' equals '],
    [/[(){}\]:;?]/g, ' '],
  ];
  SINGLE.forEach(([re, words]) => { s = s.replace(re, words); });

  return tidy(s);
}

/** How many objects sit directly inside a top-level list, ignoring anything nested deeper. */
function objectsInList(s) {
  let depth = 0; let count = 0; let quote = null;
  for (const ch of s) {
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '[') depth += 1;
    else if (ch === ']') depth -= 1;
    else if (ch === '{') { if (depth === 1) count += 1; depth += 1; }
    else if (ch === '}') depth -= 1;
  }
  return count;
}

/** Read a snapshot's text aloud: `{name: "Ada"}` → "an object where name is Ada". */
export function spokenValue(str) {
  let s = str;

  // A list of records read field by field is unlistenable; say what it is.
  if (/^\[/.test(s) && /\{/.test(s)) {
    const n = objectsInList(s);
    if (s.includes('…')) return 'a list of objects';
    return `a list of ${n} object${n === 1 ? '' : 's'}`;
  }

  s = s.replace(/…/g, ' and more');
  // Object keys, matched only right after "{" or "," so that a printed string
  // such as "Total:" is not mistaken for one. Done before quotes are stripped.
  s = s.replace(/([{,]\s*)([A-Za-z_$][\w$]*): /g, (m, lead, k) => `${lead}${camelToWords(k)} is `);
  s = s.replace(/"([^"]*)"/g, '$1');
  s = s.replace(/\[\s*\]/g, 'an empty list');
  s = s.replace(/\{\s*\}/g, 'an empty object');
  s = s.replace(/\[/g, 'a list of ').replace(/\]/g, '');
  s = s.replace(/\{/g, 'an object where ').replace(/\}/g, '');
  s = s.replace(/Set\((\d+)\)/g, 'a set of $1 items');
  s = s.replace(/Map\((\d+)\)/g, 'a map of $1 entries');
  s = s.replace(/([A-Za-z_$][\w$]*)\(\)/g, (m, f) => `the function ${camelToWords(f)}`);
  s = s.replace(/↻ circular/g, 'a circular reference');
  return tidy(s);
}

/* ---------------------------------------------------- narration → speech */

/*
 * The `(?!\})` matters: a value that is itself an object arrives as `{{{…}}}`,
 * and without it the lazy match closes one brace early and strands a "}".
 */
export const MARKUP = /`([^`]+)`|\{\{([\s\S]*?)\}\}(?!\})/g;

function speakMarkup(narr = '') {
  const s = narr
    .replace(/ → (?=\{\{(?:true|false)\}\})/g, ', which is ')
    .replace(/(meets \{\{[\s\S]*?\}\}(?!\})) → /g, '$1, which makes ')
    .replace(/ → /g, ', so ')
    .replace(/ — /g, ', ')
    .replace(/ = /g, ' equals ')
    .replace(/λ/g, 'the arrow function')
    .replace(MARKUP, (m, code, val) => (code !== undefined ? spokenCode(code) : spokenValue(val)));
  return tidy(s);
}

/* ------------------------------------------------------------- concepts */

/**
 * One sentence of "what even is this", spoken the first time a concept shows
 * up in a run — never again, so the commentary stays out of the way.
 */
const PRIMERS = {
  decl: 'A variable is just a labelled box. It holds a value so the program can use it later.',
  assign: 'Assigning replaces whatever a box held with a new value.',
  cond: 'An if statement asks a question that can only be true or false, then picks which path to follow.',
  iter: 'A loop repeats the same lines again and again, until its condition stops being true.',
  enter: 'Calling a function jumps into a reusable block of code. The call stack remembers where to come back to.',
  exit: 'When a function finishes, it hands a result back to whoever called it.',
  log: 'Console dot log simply prints something, so that you can see it.',
  compare: 'The sorter never knows what is biggest. It just asks, over and over, which of two values should come first.',
  fold: 'Reduce keeps a running total. It combines the total so far with the next item, one at a time.',
};

function conceptOf(frame) {
  switch (frame.kind) {
    case 'decl': return 'decl';
    case 'assign': return 'assign';
    case 'cond':
    case 'switch': return 'cond';
    case 'iter': return 'iter';
    case 'enter': return 'enter';
    case 'exit': return 'exit';
    case 'log': return 'log';
    case 'stage-item':
      if (frame.method === 'sort' || frame.method === 'toSorted') return 'compare';
      if (frame.method === 'reduce' || frame.method === 'reduceRight') return 'fold';
      return null;
    default: return null;
  }
}

/* ------------------------------------------------------------- the script */

function baseText(frame, meta, error) {
  switch (frame.kind) {
    case 'error': {
      const message = frame.message || (error && error.message) || '';
      const hint = error && error.hint ? ` ${error.hint}` : '';
      return tidy(`Something went wrong. ${message}.${hint}`);
    }
    case 'step': {
      // Reading a whole line of code aloud is tedious; orientation is enough,
      // except for a return, where the expression is the interesting part.
      const info = meta[frame.metaId];
      if (info && info.type === 'ReturnStatement') {
        // Returning a whole function (a closure) would mean reciting its body.
        if (/function|=>|\{/.test(info.text) || info.text.length > 70) {
          return 'Now work out the value to hand back.';
        }
        return speakMarkup(frame.narr);
      }
      return `Next, line ${frame.line}.`;
    }
    default:
      return speakMarkup(frame.narr);
  }
}

/** One spoken string per frame, indexed like `trace.frames`. */
export function buildScript(trace) {
  const frames = (trace && trace.frames) || [];
  const meta = (trace && trace.meta) || [];

  const firstSeen = new Map();
  frames.forEach((f, i) => {
    const c = conceptOf(f);
    if (c && !firstSeen.has(c)) firstSeen.set(c, i);
  });

  return frames.map((frame, i) => {
    let text = baseText(frame, meta, trace.error);
    const c = conceptOf(frame);
    if (c && firstSeen.get(c) === i) text = `${text} ${PRIMERS[c]}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  });
}
