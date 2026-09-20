/**
 * Value snapshotting.
 *
 * Runtime values are captured into plain, serialisable "VValue" trees so the UI
 * can render them long after the original object has been mutated or discarded.
 */

const MAX_ITEMS = 60;
const MAX_KEYS = 40;
const MAX_DEPTH = 4;
const MAX_STRING = 120;

/** Snapshot any JS value into a plain descriptor tree. */
export function snap(value, depth = 0, seen = new Set()) {
  const t = typeof value;

  if (value === null) return { k: 'null' };
  if (t === 'undefined') return { k: 'undef' };
  if (t === 'number') return { k: 'num', v: Object.is(value, -0) ? '-0' : String(value) };
  if (t === 'bigint') return { k: 'num', v: `${value}n` };
  if (t === 'boolean') return { k: 'bool', v: value };
  if (t === 'symbol') return { k: 'sym', v: String(value) };
  if (t === 'string') {
    return value.length > MAX_STRING
      ? { k: 'str', v: value.slice(0, MAX_STRING), cut: true }
      : { k: 'str', v: value };
  }
  if (t === 'function') {
    return { k: 'fn', v: value.name || 'ƒ', arity: value.length };
  }

  if (seen.has(value)) return { k: 'circ' };
  if (depth >= MAX_DEPTH) return { k: 'deep' };
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      const items = [];
      for (let i = 0; i < Math.min(value.length, MAX_ITEMS); i++) {
        items.push(snap(value[i], depth + 1, seen));
      }
      return { k: 'arr', items, len: value.length, cut: value.length > MAX_ITEMS };
    }
    if (value instanceof Map) {
      const entries = [];
      let i = 0;
      for (const [mk, mv] of value) {
        if (i++ >= MAX_KEYS) break;
        entries.push([snap(mk, depth + 1, seen), snap(mv, depth + 1, seen)]);
      }
      return { k: 'map', entries, len: value.size, cut: value.size > MAX_KEYS };
    }
    if (value instanceof Set) {
      const items = [];
      let i = 0;
      for (const sv of value) {
        if (i++ >= MAX_KEYS) break;
        items.push(snap(sv, depth + 1, seen));
      }
      return { k: 'set', items, len: value.size, cut: value.size > MAX_KEYS };
    }
    if (value instanceof Date) return { k: 'date', v: value.toISOString() };
    if (value instanceof RegExp) return { k: 'regex', v: String(value) };
    if (value instanceof Error) return { k: 'err', v: `${value.name}: ${value.message}` };
    if (typeof Promise !== 'undefined' && value instanceof Promise) return { k: 'promise' };

    const keys = Object.keys(value);
    const entries = [];
    for (let i = 0; i < Math.min(keys.length, MAX_KEYS); i++) {
      entries.push([keys[i], snap(value[keys[i]], depth + 1, seen)]);
    }
    const ctor = value.constructor && value.constructor.name;
    return {
      k: 'obj',
      entries,
      len: keys.length,
      cut: keys.length > MAX_KEYS,
      cls: ctor && ctor !== 'Object' ? ctor : undefined,
    };
  } catch {
    return { k: 'unknown' };
  } finally {
    seen.delete(value);
  }
}

/** One-line text rendering of a snapshot — used in narration and chips. */
export function text(v, budget = 48) {
  if (!v) return '';
  switch (v.k) {
    case 'null': return 'null';
    case 'undef': return 'undefined';
    case 'num': return v.v;
    case 'bool': return String(v.v);
    case 'str': return `"${v.v}${v.cut ? '…' : ''}"`;
    case 'sym': return v.v;
    case 'fn': return `${v.v}()`;
    case 'date': return v.v;
    case 'regex': return v.v;
    case 'err': return v.v;
    case 'circ': return '↻ circular';
    case 'deep': return '…';
    case 'promise': return 'Promise';
    case 'arr': {
      const parts = [];
      let used = 2;
      for (const it of v.items) {
        const s = text(it, 16);
        if (used + s.length > budget) { parts.push('…'); break; }
        used += s.length + 2;
        parts.push(s);
      }
      return `[${parts.join(', ')}${v.cut && parts[parts.length - 1] !== '…' ? ', …' : ''}]`;
    }
    case 'set': return `Set(${v.len})`;
    case 'map': return `Map(${v.len})`;
    case 'obj': {
      const parts = [];
      let used = 2;
      for (const [key, val] of v.entries) {
        const s = `${key}: ${text(val, 16)}`;
        if (used + s.length > budget) { parts.push('…'); break; }
        used += s.length + 2;
        parts.push(s);
      }
      return `${v.cls ? v.cls + ' ' : ''}{${parts.join(', ')}}`;
    }
    default: return '?';
  }
}

/** True when a snapshot is a compact scalar that can render as a single chip. */
export function isScalar(v) {
  return v && ['num', 'str', 'bool', 'null', 'undef', 'sym', 'date', 'regex'].includes(v.k);
}

export function equal(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
