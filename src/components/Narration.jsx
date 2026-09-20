import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MARKUP } from '../audio/script.js';

const KIND_LABEL = {
  step: 'Next line', decl: 'New variable', assign: 'Value changes',
  cond: 'Decision', switch: 'Decision', iter: 'Loop', enter: 'Function call',
  exit: 'Return', log: 'Output', 'stage-start': 'Transform',
  'stage-item': 'Item', 'stage-end': 'Result', error: 'Error', done: 'Finished',
};

/** Splits narration markup into text, `code` and {{value}} runs. */
function parse(source = '') {
  const out = [];
  const re = new RegExp(MARKUP.source, 'g');
  let last = 0;
  let m;
  while ((m = re.exec(source))) {
    if (m.index > last) out.push({ t: 'text', v: source.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: 'code', v: m[1] });
    else out.push({ t: 'value', v: m[2] });
    last = re.lastIndex;
  }
  if (last < source.length) out.push({ t: 'text', v: source.slice(last) });
  return out;
}

function SpeakerIcon({ on, speaking }) {
  return (
    <svg className={`voicebtn__icon ${speaking ? 'is-speaking' : ''}`} viewBox="0 0 20 20" aria-hidden="true">
      <path className="voicebtn__cone" d="M3 8h3l4-3.2v10.4L6 12H3z" />
      {on && <path className="voicebtn__wave voicebtn__wave--1" d="M13 7.5a3.6 3.6 0 0 1 0 5" />}
      {on && <path className="voicebtn__wave voicebtn__wave--2" d="M15.6 5a7.2 7.2 0 0 1 0 10" />}
      {!on && <path className="voicebtn__mute" d="M13 7.5l4.5 5M17.5 7.5l-4.5 5" />}
    </svg>
  );
}

/** Read-aloud switch, plus a voice picker once it is on. Hidden if the browser has no speech. */
function VoiceControls({ voice }) {
  if (!voice || !voice.supported) return null;
  return (
    <div className="voicebar">
      {voice.on && voice.voices.length > 1 && (
        <label className="voicebar__pick">
          <span className="sr-only">Voice</span>
          <select value={voice.voiceName} onChange={(e) => voice.setVoiceName(e.target.value)}>
            {voice.voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
        </label>
      )}
      <button
        className={`voicebtn ${voice.on ? 'is-on' : ''}`}
        onClick={voice.toggle}
        aria-pressed={voice.on}
        title={voice.on ? 'Stop reading aloud (V)' : 'Read each step aloud (V)'}
      >
        <SpeakerIcon on={voice.on} speaking={voice.speaking} />
        {voice.on ? 'Voice on' : 'Read aloud'}
      </button>
    </div>
  );
}

/**
 * The top of the visualiser box: a bar that matches the editor's header, then
 * the sentence. The sentence area has a fixed minimum height so the diagram
 * below never jumps when one step wraps to two lines and the next does not.
 */
export default function Narration({ frame, index, total, error, voice }) {
  const parts = useMemo(() => parse(frame ? frame.narr : ''), [frame]);
  const failed = frame ? frame.kind === 'error' : !!error;

  return (
    <div className={`narration ${failed ? 'is-error' : ''}`}>
      <div className="box__bar narration__bar">
        <span className="narration__kind">
          {frame ? (KIND_LABEL[frame.kind] || 'Step') : (error ? 'Not running' : 'Ready')}
        </span>
        {frame && <span className="narration__line">line {frame.line}</span>}
        <VoiceControls voice={voice} />
        {frame && <span className="narration__count">Step {index + 1} of {total}</span>}
      </div>

      <div className="narration__body">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={frame ? frame.i : 'idle'}
            className={`narration__text ${frame ? '' : 'narration__text--idle'}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {frame ? parts.map((p, i) => {
              if (p.t === 'code') return <code key={i} className="narration__code">{p.v}</code>;
              if (p.t === 'value') return <b key={i} className="narration__value">{p.v}</b>;
              return <span key={i}>{p.v}</span>;
            }) : (error
              ? (error.kind === 'syntax'
                ? 'This code cannot be read yet, so there is nothing to replay.'
                : 'This program did not finish, so there is nothing to replay.')
              : 'Press Run to replay your code one step at a time.')}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
