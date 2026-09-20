import React, { useMemo, useRef } from 'react';

const TONE = {
  step: 'a', decl: 'b', assign: 'b', cond: 'c', switch: 'c', iter: 'd',
  enter: 'e', exit: 'e', log: 'f', 'stage-start': 'g', 'stage-item': 'g',
  'stage-end': 'g', error: 'x', done: 'b',
};

/* Paced so one beat lands at a time — a faster default reads as a blur. */
const SPEEDS = [
  { label: '0.5×', ms: 1600 },
  { label: '1×', ms: 850 },
  { label: '2×', ms: 420 },
  { label: '4×', ms: 190 },
];

/* Drawn rather than typed: ⏮ ⏭ render as colour emoji on some platforms. */
const ICON = {
  play: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2.8v10.4L13.2 8z" /></svg>,
  pause: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" /></svg>,
  prev: <svg className="ico--line" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>,
  next: <svg className="ico--line" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>,
  first: <svg className="ico--line" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3v10M12 3L7 8l5 5" /></svg>,
  last: <svg className="ico--line" viewBox="0 0 16 16" aria-hidden="true"><path d="M12 3v10M4 3l5 5-5 5" /></svg>,
};

/** Scrub bar, play controls and a density map of the whole run. */
export default function Transport({
  frames, index, onIndex, playing, onPlay, speed, onSpeed, disabled,
}) {
  const trackRef = useRef(null);
  const total = frames.length;

  // Bucket frames so the density map stays readable for long runs.
  const buckets = useMemo(() => {
    if (!total) return [];
    const count = Math.min(total, 160);
    const size = total / count;
    return Array.from({ length: count }, (_, i) => {
      const f = frames[Math.min(total - 1, Math.floor(i * size))];
      return { tone: TONE[f.kind] || 'a', at: Math.floor(i * size) };
    });
  }, [frames, total]);

  const pct = total > 1 ? (index / (total - 1)) * 100 : 0;

  const seekFromPointer = (event) => {
    const el = trackRef.current;
    if (!el || !total) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onIndex(Math.round(ratio * (total - 1)));
  };

  return (
    <div className={`transport ${disabled ? 'is-disabled' : ''}`}>
      <div className="transport__buttons">
        <Button label="Jump to start" onClick={() => onIndex(0)} disabled={disabled || index === 0}>{ICON.first}</Button>
        <Button label="Previous step (←)" onClick={() => onIndex(index - 1)} disabled={disabled || index === 0}>{ICON.prev}</Button>
        <button
          className="transport__play"
          onClick={onPlay}
          disabled={disabled}
          title={playing ? 'Pause (space)' : 'Play (space)'}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? ICON.pause : ICON.play}
        </button>
        <Button label="Next step (→)" onClick={() => onIndex(index + 1)} disabled={disabled || index >= total - 1}>{ICON.next}</Button>
        <Button label="Jump to end" onClick={() => onIndex(total - 1)} disabled={disabled || index >= total - 1}>{ICON.last}</Button>
      </div>

      <div
        className="transport__track"
        ref={trackRef}
        role="slider"
        tabIndex={0}
        title="Drag to scrub. Each tick is one step, coloured by what happens there."
        aria-label="Step through the program"
        aria-valuemin={1}
        aria-valuemax={Math.max(total, 1)}
        aria-valuenow={index + 1}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e);
        }}
        onPointerMove={(e) => { if (e.buttons === 1 && !disabled) seekFromPointer(e); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); onIndex(index - 1); }
          if (e.key === 'ArrowRight') { e.preventDefault(); onIndex(index + 1); }
        }}
      >
        <div className="transport__density">
          {buckets.map((b, i) => (
            <span key={i} className={`tick tone-${b.tone} ${b.at <= index ? 'is-past' : ''}`} />
          ))}
        </div>
        <div className="transport__thumb" style={{ left: `${pct}%` }} />
      </div>

      <div className="transport__right">
        <span className="transport__pos">{total ? index + 1 : 0}<i>/</i>{total}</span>
        <div className="speeds" role="group" aria-label="Playback speed">
          {SPEEDS.map((sp) => (
            <button
              key={sp.label}
              className={`speeds__btn ${speed === sp.ms ? 'is-on' : ''}`}
              onClick={() => onSpeed(sp.ms)}
            >
              {sp.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Button({ children, label, ...rest }) {
  return (
    <button className="transport__btn" aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export { SPEEDS };
