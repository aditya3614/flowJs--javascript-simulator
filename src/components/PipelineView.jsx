import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ValueView, { Chip } from './ValueView.jsx';
import { text } from '../engine/value.js';

// Critically damped: things settle into place, they never bounce.
const spring = { type: 'spring', stiffness: 260, damping: 34, mass: 0.9 };

/**
 * Draws a chain of array transformations as a stack of stage cards, with the
 * active stage showing each item moving through it.
 */
export default function PipelineView({ pipeline, at }) {
  if (!pipeline || !pipeline.stages.length) return null;
  const { si, item, phase, stale } = at;

  return (
    <div className={`pipe ${stale ? 'is-stale' : ''}`}>
      <div className="pipe__source">
        <span className="tag">start with</span>
        <ValueView v={pipeline.stages[0].input} />
      </div>

      {pipeline.stages.map((stage, j) => {
        const state = j < si ? 'done' : j === si ? (phase === 'end' ? 'done' : 'active') : 'ahead';
        const shown = j < si
          ? stage.items.length
          : j === si
            ? (phase === 'start' ? 0 : Math.min(item + 1, stage.items.length))
            : 0;
        return (
          <React.Fragment key={j}>
            <Connector active={state === 'active'} />
            <Stage stage={stage} state={state} shown={shown} focus={state === 'active' ? item : -1} />
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Connector({ active }) {
  return (
    <div className={`pipe__link ${active ? 'is-active' : ''}`} aria-hidden="true">
      <span className="pipe__linkLine" />
      {active && <span className="pipe__linkDot" />}
    </div>
  );
}

function Stage({ stage, state, shown, focus }) {
  const hasItems = stage.items.length > 0;

  return (
    <motion.section
      layout
      transition={spring}
      className={`stage is-${state} mode-${stage.mode || 'plain'}`}
    >
      <header className="stage__head">
        <span className="stage__badge">{stage.method}</span>
        <p className="stage__story">{stage.story}</p>
        {state === 'done' && <span className="stage__check">✓</span>}
      </header>

      {stage.body && (
        <div className="stage__rule mono">
          <span className="stage__ruleLabel">rule</span>
          {stage.params.length > 0 && <span className="stage__params">{stage.params.join(', ')} →</span>}
          {stage.body}
        </div>
      )}
      {!stage.body && stage.args.length > 0 && (
        <div className="stage__rule mono">
          <span className="stage__ruleLabel">with</span>
          {stage.args.map((a, i) => <Chip key={i} v={a} />)}
        </div>
      )}

      <div className="stage__body">
        {hasItems ? (
          <ItemRail stage={stage} shown={shown} focus={focus} state={state} />
        ) : (
          <PlainFlow stage={stage} state={state} />
        )}
      </div>

      <footer className="stage__foot">
        <span className="stage__footLabel">
          {state === 'ahead' ? 'not run yet' : state === 'active' ? 'building…' : 'result'}
        </span>
        <StageOutput stage={stage} state={state} shown={shown} />
      </footer>
    </motion.section>
  );
}

/** Builds a new list — its progress can be shown while it runs. */
const COLLECTORS = new Set(['filter', 'map', 'flatMap']);

/**
 * While a stage runs, show only what it has actually produced. Revealing the
 * finished answer early would give away the very thing being explained.
 */
function StageOutput({ stage, state, shown }) {
  if (state === 'ahead') return <span className="value-empty">—</span>;
  if (state === 'done') return <ValueView v={stage.output ?? stage.input} />;

  const done = stage.items.slice(0, shown);

  if (COLLECTORS.has(stage.method)) {
    const items = stage.method === 'filter'
      ? done.filter((d) => d.kept).map((d) => d.value)
      : done.map((d) => d.result);
    return items.length
      ? <ValueView v={{ k: 'arr', items, len: items.length }} />
      : <span className="value-empty">nothing yet</span>;
  }
  if (stage.mode === 'fold' && done.length) {
    return <ValueView v={done[done.length - 1].result} />;
  }
  if (stage.mode === 'compare' && done.length) {
    return <ValueView v={done[done.length - 1].state} />;
  }
  return <span className="value-empty">working…</span>;
}

/* -------------------------------------------------------------- per item */

function ItemRail({ stage, shown, focus, state }) {
  const mode = stage.mode || 'transform';
  const processed = stage.items.slice(0, shown);
  const current = focus >= 0 && focus < stage.items.length ? stage.items[focus] : null;

  if (mode === 'compare') {
    return (
      <div className="rail rail--compare">
        <div className="rail__focus">
          <AnimatePresence mode="wait" initial={false}>
            {current ? (
              <motion.div className="cmp" key={focus}
                initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}>
                <div className={`cmp__side ${current.order === 'keep' ? 'is-win' : ''}`}>
                  <ValueView v={current.a} dense />
                </div>
                <div className="cmp__vs">
                  <span className="cmp__op">{current.order === 'keep' ? '≤' : '>'}</span>
                  <span className="cmp__note">
                    {current.order === 'keep' ? 'stays in front' : 'swap them'}
                  </span>
                </div>
                <div className={`cmp__side ${current.order === 'swap' ? 'is-win' : ''}`}>
                  <ValueView v={current.b} dense />
                </div>
              </motion.div>
            ) : (
              <motion.p className="rail__idle" key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                comparing pairs…
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        {current && current.state && (
          <SortStrip state={current.state} a={current.a} b={current.b} />
        )}
        <div className="rail__meter">
          <span>{processed.length} comparison{processed.length === 1 ? '' : 's'} so far</span>
          {stage.truncated && <span className="rail__cut">only the first few are shown</span>}
        </div>
      </div>
    );
  }

  if (mode === 'fold') {
    const acc = current ? current.result : (processed.length ? processed[processed.length - 1].result : null);
    return (
      <div className="rail rail--fold">
        <div className="fold">
          <div className="fold__pot">
            <span className="fold__potLabel">running total</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={text(acc)} className="fold__potValue"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={spring}>
                <ValueView v={acc} dense />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="fold__feed">
            {stage.items.map((it, i) => (
              <motion.span layout key={i} transition={spring}
                className={`pellet ${i < shown ? 'is-eaten' : ''} ${i === focus ? 'is-focus' : ''}`}>
                {text(it.value, 10)}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isTest = mode === 'test';
  return (
    <div className="rail">
      <div className="rail__strip">
        {stage.items.map((it, i) => {
          const seen = i < shown;
          const isFocus = i === focus;
          const verdict = !seen ? 'wait' : (isTest ? (it.kept ? 'yes' : 'no') : 'ok');
          return (
            <motion.div
              layout key={i} transition={spring}
              className={`node node--${verdict} ${isFocus ? 'is-focus' : ''}`}
            >
              <span className="node__in">{text(it.value, 26)}</span>
              {seen && !isTest && (
                <>
                  <span className="node__to">→</span>
                  <span className="node__out">{text(it.result, 26)}</span>
                </>
              )}
              {seen && isTest && (
                <span className="node__mark">{it.kept ? '✓' : '✕'}</span>
              )}
            </motion.div>
          );
        })}
        {stage.truncated && <span className="rail__cut">…</span>}
      </div>
      {state === 'active' && current && (
        <motion.p className="rail__caption" key={focus}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          {isTest
            ? (current.kept ? `keeping ${text(current.value, 30)}` : `dropping ${text(current.value, 30)}`)
            : `${text(current.value, 30)} becomes ${text(current.result, 30)}`}
        </motion.p>
      )}
    </div>
  );
}

/** The list mid-sort, with the two values under comparison picked out. */
function SortStrip({ state, a, b }) {
  const items = state.items || [];
  const aText = text(a, 12);
  const bText = text(b, 12);
  let usedA = false;
  let usedB = false;

  return (
    <div className="sortstrip">
      <span className="sortstrip__label">the list right now</span>
      <div className="sortstrip__cells">
        {items.map((it, i) => {
          const label = text(it, 12);
          let role = '';
          if (!usedA && label === aText) { role = 'a'; usedA = true; }
          else if (!usedB && label === bText) { role = 'b'; usedB = true; }
          return (
            <motion.span layout key={`${label}-${i}`} transition={spring}
              className={`sortcell ${role ? `is-${role}` : ''}`}>
              {label}
            </motion.span>
          );
        })}
      </div>
    </div>
  );
}

function PlainFlow({ stage, state }) {
  return (
    <div className="plainflow">
      <div className="plainflow__side">
        <span className="tag">in</span>
        <ValueView v={stage.input} />
      </div>
      <div className="plainflow__arrow" aria-hidden="true">
        <svg viewBox="0 0 48 12"><path d="M1 6 H40 M34 1.5 L41 6 L34 10.5" /></svg>
      </div>
      <div className="plainflow__side">
        <span className="tag">out</span>
        {state === 'ahead' ? <span className="value-empty">—</span> : <ValueView v={stage.output} />}
      </div>
    </div>
  );
}
