import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import CodeEditor from './components/CodeEditor.jsx';
import Narration from './components/Narration.jsx';
import MomentView from './components/MomentView.jsx';
import PipelineView from './components/PipelineView.jsx';
import ConsoleView from './components/ConsoleView.jsx';
import Transport, { SPEEDS } from './components/Transport.jsx';
import StoryTrail from './components/StoryTrail.jsx';
import { ScopeView, StackView } from './components/MemoryView.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import FitToBox from './components/FitToBox.jsx';
import DotField from './components/DotField.jsx';
import Mascot from './components/Mascot.jsx';
import { useNarrator } from './audio/useNarrator.js';

import { runSandboxed } from './engine/sandbox.js';
import { EXAMPLES, DEFAULT_EXAMPLE } from './examples.js';

const EMPTY = { frames: [], pipelines: [], output: [], meta: [], error: null, ok: true };

export default function App() {
  const [code, setCode] = useState(DEFAULT_EXAMPLE.code);
  const [exampleId, setExampleId] = useState(DEFAULT_EXAMPLE.id);
  const [trace, setTrace] = useState(EMPTY);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(SPEEDS[1].ms);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('output');
  const runId = useRef(0);

  const frames = trace.frames;
  const frame = frames[Math.min(index, Math.max(frames.length - 1, 0))] || null;

  const narr = useNarrator({ trace, frames, index, playing, speed });

  /* ------------------------------------------------------------- running */

  const execute = useCallback(async (source, { autoplay = true } = {}) => {
    const mine = ++runId.current;
    setBusy(true);
    setPlaying(false);
    const result = await runSandboxed(source);
    // A newer run has started since (another example, or Run pressed again).
    // Its result is the one to show; this one may arrive late, or never.
    if (mine !== runId.current) return;
    setTrace({ ...result, runId: mine });
    setIndex(0);
    setDirty(false);
    setBusy(false);
    if (result.error) setTab('output');
    if (autoplay && !result.error && result.frames.length > 1) setPlaying(true);
  }, []);

  useEffect(() => { execute(DEFAULT_EXAMPLE.code, { autoplay: false }); }, [execute]);

  /* ------------------------------------------------------------ playback */

  /*
   * With the voice on, the timeline is driven by the voice: a step ends when its
   * sentence does, plus a short breath. The last step is held until it has been
   * spoken in full, so the closing line is never cut off.
   */
  useEffect(() => {
    if (!playing) return undefined;
    if (index >= frames.length - 1) {
      if (!narr.on || narr.ready) setPlaying(false);
      return undefined;
    }
    if (narr.on && !narr.ready) return undefined;
    const wait = narr.on ? narr.gap : speed;
    const id = setTimeout(() => setIndex((i) => Math.min(i + 1, frames.length - 1)), wait);
    return () => clearTimeout(id);
  }, [playing, index, frames.length, speed, narr.on, narr.ready, narr.gap]);

  const seek = useCallback((next) => {
    setPlaying(false);
    setIndex(Math.min(Math.max(next, 0), Math.max(frames.length - 1, 0)));
  }, [frames.length]);

  const togglePlay = useCallback(() => {
    if (!frames.length) return;
    if (index >= frames.length - 1) setIndex(0);
    setPlaying((p) => !p);
  }, [frames.length, index]);

  /* ----------------------------------------------------------- shortcuts */

  useEffect(() => {
    const onKey = (e) => {
      const inEditor = e.target.closest && e.target.closest('.cm-editor');
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'Enter')) {
        e.preventDefault();
        execute(code);
        return;
      }
      if (inEditor) return;
      if ((e.key === 'v' || e.key === 'V') && narr.supported) { narr.toggle(); return; }
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); seek(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); seek(index - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [code, execute, index, seek, togglePlay, narr.supported, narr.toggle]);

  /* -------------------------------------------------------------- derived */

  const pipeline = frame && frame.pipe ? trace.pipelines[frame.pipe.pid] : null;
  const livePipeline = pipeline && frame.pipe && !frame.pipe.stale;

  /*
   * Exactly one diagram is on screen at a time. A pipeline stage already says
   * everything the moment card would, and showing both at once is the single
   * biggest source of "too much happening" during playback.
   */
  const showMoment = frame && !(livePipeline && frame.kind.startsWith('stage'));

  const tabs = useMemo(() => [
    { id: 'output', label: 'Output', count: frame ? frame.outLen : 0 },
    { id: 'vars', label: 'Variables', count: frame ? Object.keys(frame.scope || {}).length : 0 },
    { id: 'stack', label: 'Call stack', count: frame && frame.stack ? frame.stack.length : 0 },
    { id: 'steps', label: 'Steps', count: frames.length },
  ], [frame, frames.length]);

  const onPickExample = (id) => {
    const found = EXAMPLES.find((e) => e.id === id);
    if (!found) return;
    setExampleId(id);
    setCode(found.code);
    execute(found.code, { autoplay: false });
  };

  const onCodeChange = (next) => {
    setCode(next);
    setDirty(true);
    setExampleId('');
  };

  return (
    <>
      <DotField />
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <Mascot className="brand__mark" />
            <div className="brand__text">
              <h1>FlowJS</h1>
              <p>See your JavaScript think</p>
            </div>
          </div>

          <a
            className="xlink"
            href="https://x.com/adityadave89"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Aditya Dave on X (opens in a new tab)"
            title="@adityadave89 on X"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </header>

      <div className="shell">
        {/* ------------------------------------------- box 1 · the code */}
        <section className="box box--code is-dark" aria-label="Code">
          <header className="box__bar">
            <div className="bar__left">
              <span className="tag">Example</span>
              <label className="pick">
                <span className="sr-only">Choose an example</span>
                <select
                  value={exampleId}
                  onChange={(e) => onPickExample(e.target.value)}
                  className="pick__select"
                >
                  {!exampleId && <option value="">Your own code</option>}
                  {EXAMPLES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <span className="pick__chev" aria-hidden="true">▾</span>
              </label>
            </div>

            <button className="run" onClick={() => execute(code)} disabled={busy}>
              {busy ? 'Running' : dirty ? 'Run changes' : 'Run'}
              <kbd>⌘↵</kbd>
            </button>
          </header>

          <div className="editor__body">
            <ErrorBoundary label="The editor" resetKey={exampleId}>
              <CodeEditor
                value={code}
                onChange={onCodeChange}
                activeLine={frame ? frame.line : 0}
                activeSpan={frame ? frame.endLine : 0}
              />
            </ErrorBoundary>
          </div>

          <div className="detail">
            <div className="detail__tabs" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`detail__tab ${tab === t.id ? 'is-on' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {t.count > 0 && <span className="detail__badge">{t.count}</span>}
                </button>
              ))}
            </div>

            <div className="detail__body" role="tabpanel">
              <ErrorBoundary label="This panel" resetKey={tab}>
                {tab === 'output' && (
                  <ConsoleView output={trace.output} upTo={frame ? frame.outLen : 0} error={trace.error} />
                )}
                {tab === 'vars' && <ScopeView frame={frame} />}
                {tab === 'stack' && <StackView frame={frame} />}
                {tab === 'steps' && (
                  frames.length
                    ? <StoryTrail frames={frames} index={index} onPick={seek} />
                    : <p className="empty-note">Run your code to see every step listed here.</p>
                )}
              </ErrorBoundary>
            </div>
          </div>
        </section>

        {/* -------------------------------------- box 2 · the visualiser */}
        <section className="box box--viz" aria-label="Visualiser">
          <Narration frame={frame} index={index} total={frames.length} error={trace.error} voice={narr} />

          <div className="viz__canvas">
            <ErrorBoundary label="The visualiser" resetKey={trace}>
              {trace.error && !frames.length ? (
                <ProblemCard error={trace.error} />
              ) : !frames.length ? (
                <EmptyState busy={busy} />
              ) : (
                <FitToBox className="viz__center">
                  {showMoment && <MomentView frame={frame} meta={trace.meta} />}
                  {/* popLayout: a pipeline that is fading out must not keep taking space,
                      or the diagram would briefly double in height and the fit would lurch. */}
                  <AnimatePresence initial={false} mode="popLayout">
                    {pipeline && (
                      <motion.div
                        key={frame.pipe.pid}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <PipelineView pipeline={pipeline} at={frame.pipe} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </FitToBox>
              )}
            </ErrorBoundary>
          </div>

          {trace.truncated && <p className="truncated">{trace.truncated}</p>}

          <Transport
            frames={frames}
            index={index}
            onIndex={seek}
            playing={playing}
            onPlay={togglePlay}
            speed={speed}
            onSpeed={setSpeed}
            disabled={!frames.length}
          />
        </section>
      </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ cards */

/** Shown when a run produced no trace at all — unreadable code, or a program that got stuck. */
const BADGE = { syntax: 'Can’t read this yet', timeout: 'Got stuck', unavailable: 'Can’t run here' };

function ProblemCard({ error }) {
  return (
    <div className="notice notice--warn">
      <span className="notice__badge">{BADGE[error.kind] || 'Stopped'}</span>
      <p className="notice__msg mono">{error.message}</p>
      {error.line && <p className="notice__line">Look at line {error.line}.</p>}
      {error.hint && <p className="notice__hint">{error.hint}</p>}
    </div>
  );
}

function EmptyState({ busy }) {
  return (
    <div className="notice">
      <p className="notice__title">{busy ? 'Working through your code…' : 'Nothing to replay yet'}</p>
      <p className="notice__hint">
        Press <b>Run</b>, then step through with the controls below.
      </p>
    </div>
  );
}
