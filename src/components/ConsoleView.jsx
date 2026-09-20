import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ValueView from './ValueView.jsx';

/** Console output, revealed only up to the current step. */
export default function ConsoleView({ output, upTo, error }) {
  const lines = output.slice(0, upTo);
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [lines.length]);

  return (
    <div className="console">
      <div className="console__body">
        {lines.length === 0 && !error && (
          <p className="console__empty">Nothing has been printed yet.</p>
        )}
        <AnimatePresence initial={false}>
          {lines.map((line, i) => (
            <motion.div
              key={i} className={`cline cline--${line.method}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="cline__gutter">›</span>
              <div className="cline__parts">
                {line.parts.map((p, j) => <ValueView key={j} v={p} dense max={10} />)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {error && (
          <motion.div className="cerror" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <div className="cerror__head">
              <span className="cerror__badge">{error.name || 'Error'}</span>
              {error.line && <span className="cerror__line">line {error.line}</span>}
            </div>
            <div className="cerror__msg mono">{error.message}</div>
            {error.hint && <div className="cerror__hint">{error.hint}</div>}
          </motion.div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
