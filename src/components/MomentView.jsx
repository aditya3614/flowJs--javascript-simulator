import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ValueView, { Chip } from './ValueView.jsx';

const spring = { type: 'spring', stiffness: 260, damping: 34, mass: 0.9 };
/*
 * A short cross-fade with a hint of travel: enough to register that the subject
 * changed, not enough to compete with the sentence above it.
 */
const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
};

/**
 * The current beat of the program, drawn as a small diagram. Each kind of
 * moment gets a shape you can read at a glance.
 */
export default function MomentView({ frame, meta }) {
  if (!frame) return null;
  return (
    <div className="moment">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div className="moment__stage" key={`${frame.kind}-${frame.i}`} {...rise}>
          {render(frame, meta)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function render(frame, meta) {
  switch (frame.kind) {
    case 'decl': return <DeclMoment frame={frame} />;
    case 'assign': return <AssignMoment frame={frame} />;
    case 'cond': return <CondMoment frame={frame} />;
    case 'switch': return <CondMoment frame={frame} />;
    case 'iter': return <LoopMoment frame={frame} />;
    case 'enter': return <CallMoment frame={frame} />;
    case 'exit': return <ReturnMoment frame={frame} />;
    case 'log': return <LogMoment frame={frame} />;
    case 'error': return <ErrorMoment frame={frame} />;
    case 'done': return <DoneMoment />;
    default: return <StepMoment frame={frame} meta={meta} />;
  }
}

/* ------------------------------------------------------------------ boxes */

function Box({ label, children, tone = '', badge }) {
  return (
    <div className={`vbox ${tone}`}>
      <div className="vbox__label">
        {label}
        {badge && <span className="vbox__badge">{badge}</span>}
      </div>
      <div className="vbox__body">{children}</div>
    </div>
  );
}

function DeclMoment({ frame }) {
  if (frame.unpacked) {
    return (
      <div className="moment__row moment__row--wrap">
        {Object.entries(frame.unpacked).map(([name, v]) => (
          <motion.div key={name} layout transition={spring}>
            <Box label={name} tone="is-new"><ValueView v={v} /></Box>
          </motion.div>
        ))}
      </div>
    );
  }
  return (
    <div className="moment__row">
      <Box label={frame.name} tone="is-new" badge={frame.varKind}>
        <ValueView v={frame.value} />
      </Box>
    </div>
  );
}

function AssignMoment({ frame }) {
  return (
    <div className="moment__row">
      {frame.prev && (
        <>
          <Box label="was" tone="is-past"><ValueView v={frame.prev} /></Box>
          <Arrow />
        </>
      )}
      <Box label={frame.name} tone="is-new"><ValueView v={frame.value} /></Box>
    </div>
  );
}

function CondMoment({ frame }) {
  const yes = frame.truthy;
  return (
    <div className="fork">
      <div className="fork__test mono">{frame.test}</div>
      <svg className="fork__svg" viewBox="0 0 300 64" preserveAspectRatio="none" aria-hidden="true">
        <path d="M150 2 V20" className="fork__stem" />
        <path d="M150 20 C150 46, 75 36, 75 62" className={`fork__branch ${yes ? 'is-on' : ''}`} />
        <path d="M150 20 C150 46, 225 36, 225 62" className={`fork__branch ${!yes ? 'is-on' : ''}`} />
      </svg>
      <div className="fork__ends">
        <div className={`fork__end ${yes ? 'is-on' : ''}`}>
          <span className="fork__endLabel">true</span>
          <span className="fork__endNote">run this block</span>
        </div>
        <div className={`fork__end ${!yes ? 'is-on' : ''}`}>
          <span className="fork__endLabel">false</span>
          <span className="fork__endNote">skip past it</span>
        </div>
      </div>
    </div>
  );
}

function LoopMoment({ frame }) {
  const vars = Object.entries(frame.scope || {}).slice(0, 4);
  return (
    <div className="loopm">
      <div className="loopm__ring">
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <circle className="loopm__track" cx="48" cy="48" r="38" />
          <motion.circle
            className="loopm__arc" cx="48" cy="48" r="38"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="loopm__count">
          <b>{frame.iteration}</b>
          <span>round{frame.iteration === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div className="loopm__vars">
        {vars.map(([k, v]) => (
          <motion.div key={k} layout transition={spring} className="loopm__var">
            <span className="loopm__varName mono">{k}</span>
            <ValueView v={v} dense />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CallMoment({ frame }) {
  const args = Object.entries(frame.args || {});
  return (
    <div className="callm">
      <div className="callm__head">
        <span className="callm__arrow">↘</span>
        <span className="callm__name mono">{frame.fnName}</span>
      </div>
      <div className="callm__args">
        {args.length === 0 && <span className="value-empty">no inputs</span>}
        {args.map(([k, v]) => (
          <div className="callm__arg" key={k}>
            <span className="callm__argName mono">{k}</span>
            <Chip v={v} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReturnMoment({ frame }) {
  return (
    <div className="moment__row">
      <Box label={frame.fnName} tone="is-call"><span className="value-empty">finished</span></Box>
      <Arrow label="hands back" />
      <Box label="result" tone="is-new"><ValueView v={frame.value} /></Box>
    </div>
  );
}

function LogMoment({ frame }) {
  return (
    <div className="logm">
      <span className="logm__label">console</span>
      <div className="logm__parts">
        {(frame.parts || []).map((p, i) => <ValueView key={i} v={p} />)}
      </div>
    </div>
  );
}

function ErrorMoment({ frame }) {
  return (
    <div className="errm">
      <span className="errm__icon">!</span>
      <div>
        <div className="errm__title">The program stopped here</div>
        <div className="errm__msg mono">{frame.message || frame.narr}</div>
      </div>
    </div>
  );
}

function DoneMoment() {
  return (
    <div className="donem">
      <motion.div
        className="donem__tick"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring}
      >
        ✓
      </motion.div>
      <div className="donem__text">Program finished</div>
    </div>
  );
}

function StepMoment({ frame, meta }) {
  const info = meta && meta[frame.metaId];
  return (
    <div className="stepm">
      <span className="stepm__label">about to run</span>
      <code className="stepm__code">{info ? info.text : `line ${frame.line}`}</code>
    </div>
  );
}

function Arrow({ label }) {
  return (
    <div className="varrow" aria-hidden="true">
      {label && <span className="varrow__label">{label}</span>}
      <svg viewBox="0 0 44 12"><path d="M1 6 H36 M30 1.5 L37 6 L30 10.5" /></svg>
    </div>
  );
}
