import React from 'react';
import { motion } from 'framer-motion';
import { text } from '../engine/value.js';

/** A single scalar rendered as a coloured chip. */
export function Chip({ v, className = '', ...rest }) {
  if (!v) return <span className={`chip chip--empty ${className}`}>—</span>;
  const tone = {
    num: 'num', str: 'str', bool: 'bool',
    null: 'empty', undef: 'empty', fn: 'fn', err: 'err',
  }[v.k] || '';
  return (
    <span className={`chip ${tone ? `chip--${tone}` : ''} ${className}`} {...rest}>
      {text(v, 30)}
    </span>
  );
}

/**
 * Renders a snapshot. Lists become a row of cells, objects a small record
 * card, everything else a chip.
 */
export default function ValueView({ v, dense = false, max = 14 }) {
  if (!v) return <span className="chip chip--empty">—</span>;

  if (v.k === 'arr' || v.k === 'set') {
    const items = v.items || [];
    if (!items.length) {
      return <span className="value-empty">empty {v.k === 'set' ? 'set' : 'list'}</span>;
    }
    return (
      <div className={`value-list ${dense ? 'is-dense' : ''}`}>
        {items.slice(0, max).map((item, i) => (
          <div className="cell" key={i}>
            {!dense && <span className="cell__index">{i}</span>}
            <div className="cell__body"><ValueView v={item} dense max={4} /></div>
          </div>
        ))}
        {(items.length > max || v.cut) && (
          <div className="cell cell--more">+{(v.len ?? items.length) - Math.min(max, items.length)}</div>
        )}
      </div>
    );
  }

  if (v.k === 'obj' || v.k === 'map') {
    const entries = v.k === 'map'
      ? (v.entries || []).map(([k, val]) => [text(k, 14), val])
      : (v.entries || []);
    if (!entries.length) return <span className="value-empty">empty object</span>;
    if (dense) return <span className="chip">{text(v, 34)}</span>;
    return (
      <div className="value-record">
        {v.cls && <div className="value-record__class">{v.cls}</div>}
        {entries.slice(0, 6).map(([k, val]) => (
          <div className="value-record__row" key={k}>
            <span className="value-record__key">{k}</span>
            <ValueView v={val} dense max={4} />
          </div>
        ))}
        {entries.length > 6 && <div className="value-record__row value-record__more">+{entries.length - 6} more</div>}
      </div>
    );
  }

  return <Chip v={v} />;
}

/** A value that pulses when it changes — used for live variables. */
export function LiveValue({ v, id }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <ValueView v={v} />
    </motion.div>
  );
}
