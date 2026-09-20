import React, { useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ValueView, { Chip } from './ValueView.jsx';
import { equal } from '../engine/value.js';

const spring = { type: 'spring', stiffness: 260, damping: 34, mass: 0.9 };

/** Variables in the current scope, flashing when they change. */
export function ScopeView({ frame }) {
  // null until the first render: a freshly opened tab has nothing to compare
  // against, so it must not report every variable as "changed".
  const prev = useRef(null);
  const scope = (frame && frame.scope) || {};

  const changed = useMemo(() => {
    const set = new Set();
    if (prev.current === null) { prev.current = scope; return set; }
    for (const key of Object.keys(scope)) {
      if (!(key in prev.current) || !equal(prev.current[key], scope[key])) set.add(key);
    }
    prev.current = scope;
    return set;
  }, [scope]);

  const entries = Object.entries(scope);

  return (
    <section className="panel">
      <div className="panel__body">
        {entries.length === 0 && <p className="panel__empty">Nothing has been created yet.</p>}
        <div className="vars">
          <AnimatePresence initial={false}>
            {entries.map(([name, value]) => (
              <motion.div
                layout key={name} transition={spring}
                className={`var ${changed.has(name) ? 'is-changed' : ''}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                <span className="var__name mono">{name}</span>
                <div className="var__value"><ValueView v={value} max={10} dense /></div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/** The call stack, newest frame on top. */
export function StackView({ frame }) {
  const stack = (frame && frame.stack) || [];
  return (
    <section className="panel">
      <div className="panel__body">
        {stack.length === 0 && <p className="panel__empty">Running at the top level — no function calls are open.</p>}
        <div className="stack">
          <AnimatePresence initial={false}>
            {stack.slice().reverse().map((f, i) => (
              <motion.div
                layout key={f.id} transition={spring}
                className={`sframe ${i === 0 ? 'is-top' : ''}`}
                initial={{ opacity: 0, y: -14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                style={{ zIndex: stack.length - i }}
              >
                <div className="sframe__head">
                  <span className="sframe__name mono">{f.name}</span>
                  <span className="sframe__line">line {f.line}</span>
                </div>
                <div className="sframe__args">
                  {Object.entries(f.args || {}).length === 0
                    ? <span className="value-empty">no inputs</span>
                    : Object.entries(f.args).map(([k, v]) => (
                      <span className="sframe__arg" key={k}>
                        <span className="mono">{k}</span>
                        <Chip v={v} />
                      </span>
                    ))}
                </div>
                {f.ret !== undefined && (
                  <div className="sframe__ret">
                    <span>returns</span><Chip v={f.ret} />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
