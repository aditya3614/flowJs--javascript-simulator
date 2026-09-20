import React, { useEffect, useMemo, useRef } from 'react';

/** Strips narration markup down to plain text for the transcript. */
function plain(source = '') {
  return source.replace(/`([^`]+)`/g, '$1').replace(/\{\{([\s\S]*?)\}\}(?!\})/g, '$1');
}

const DOT = {
  decl: 'b', assign: 'b', done: 'b', cond: 'c', switch: 'c', iter: 'd',
  enter: 'e', exit: 'e', log: 'f', 'stage-start': 'g', 'stage-item': 'g',
  'stage-end': 'g', error: 'x',
};

/** How many rows are kept in the DOM around the current step. */
const WINDOW = 80;

/**
 * A running transcript of the program — what makes a long run read as a story
 * rather than a blur.
 *
 * Only a window around the current step is rendered. A long trace can reach
 * thousands of steps, and mounting every row (let alone animating each one)
 * costs far more than it shows.
 */
export default function StoryTrail({ frames, index, onPick }) {
  const listRef = useRef(null);

  const rows = useMemo(() => {
    if (frames.length <= WINDOW) return frames;
    const start = Math.max(0, Math.min(index - Math.floor(WINDOW / 2), frames.length - WINDOW));
    return frames.slice(start, start + WINDOW);
  }, [frames, index]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const active = el.querySelector('.trail__row.is-now');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [index, rows]);

  if (!frames.length) return null;

  return (
    <section className="trail">
      <div className="trail__list" ref={listRef}>
        {rows.map((f) => {
          const state = f.i === index ? 'is-now' : f.i < index ? 'is-past' : 'is-future';
          return (
            <button
              key={f.i}
              className={`trail__row ${state}`}
              onClick={() => onPick(f.i)}
            >
              <span className={`trail__dot tone-${DOT[f.kind] || 'a'}`} />
              <span className="trail__line mono">{f.line}</span>
              <span className="trail__text">{plain(f.narr)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
