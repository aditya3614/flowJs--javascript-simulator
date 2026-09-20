import React, { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, Decoration, gutter, GutterMarker } from '@codemirror/view';
import { StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/* The line the visualiser is currently sitting on. */
const setActiveLine = StateEffect.define();

const activeLineField = StateField.define({
  create: () => ({ line: 0, span: 0 }),
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setActiveLine)) return e.value;
    return value;
  },
});

/*
 * `'doc'` must be a dependency: without it the computed decoration set is reused
 * across edits, so positions from the old document survive into the new one and
 * CodeMirror throws while measuring them.
 */
const lineDecorations = EditorView.decorations.compute(['doc', activeLineField], (state) => {
  const { line, span } = state.field(activeLineField);
  if (!line) return Decoration.none;
  const builder = new RangeSetBuilder();
  const last = Math.min(state.doc.lines, Math.max(line, span || line));
  for (let n = line; n <= last; n++) {
    const from = state.doc.line(n).from;
    builder.add(from, from, Decoration.line({
      class: n === line ? 'cm-flow-active' : 'cm-flow-span',
    }));
  }
  return builder.finish();
});

class ArrowMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-flow-arrow';
    el.textContent = '▶';
    return el;
  }
}
const arrowMarker = new ArrowMarker();

const activeGutter = gutter({
  class: 'cm-flow-gutter',
  lineMarker(view, block) {
    const { line } = view.state.field(activeLineField);
    if (!line) return null;
    const at = view.state.doc.lineAt(block.from).number;
    return at === line ? arrowMarker : null;
  },
  lineMarkerChange: (update) => update.transactions.some((tr) => tr.effects.some((e) => e.is(setActiveLine))),
  initialSpacer: () => arrowMarker,
});

/*
 * Syntax colours on the system's near-black. Everything comes from the warm
 * palette: terracotta for keywords, seafoam for strings, sky for numbers, sand
 * for names. Comments recede to stone.
 */
const highlight = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#87867f', fontStyle: 'italic' },
  { tag: [t.keyword, t.moduleKeyword, t.definitionKeyword, t.controlKeyword], color: '#d97757' },
  { tag: [t.string, t.special(t.string)], color: '#bcd1ca' },
  { tag: [t.number, t.bool, t.null], color: '#6a9bcc' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#ebcece' },
  { tag: [t.definition(t.variableName)], color: '#faf9f5' },
  { tag: [t.variableName], color: '#e3dacc' },
  { tag: [t.propertyName], color: '#c6c4ba' },
  { tag: [t.typeName, t.className], color: '#ebcece' },
  { tag: [t.regexp], color: '#c46686' },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: '#87867f' },
]);

const theme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: '#faf9f5', height: '100%' },
  '.cm-scroller': {
    fontFamily: "'Source Code Pro', ui-monospace, monospace",
    fontSize: '14.5px',
    lineHeight: '1.85',
    padding: '16px 0 24px',
  },
  '.cm-content': { caretColor: '#d97757' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#5f5e59',
    paddingLeft: '12px',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#b0aea5' },
  '.cm-activeLine': { backgroundColor: 'rgba(250,249,245,0.035)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(217,119,87,0.3)',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#d97757', borderLeftWidth: '2px' },
  '.cm-flow-gutter': { minWidth: '16px' },
  '.cm-flow-arrow': { color: '#d97757', fontSize: '9px' },
  '.cm-tooltip': {
    border: '1px solid rgba(250,249,245,0.18)',
    backgroundColor: '#141413',
    borderRadius: '8px',
  },
}, { dark: true });

export default function CodeEditor({ value, onChange, activeLine, activeSpan, editable = true }) {
  const viewRef = useRef(null);
  const lastEditRef = useRef(0);

  const extensions = useMemo(() => [
    javascript(),
    activeLineField,
    lineDecorations,
    activeGutter,
    syntaxHighlighting(highlight),
    EditorView.lineWrapping,
  ], []);

  /*
   * The highlight is applied on the next frame and read from the live state.
   * Doing it inline races with the document sync: a scroll position computed
   * against the old document is absolute, so it lands out of range once the
   * text has changed underneath it.
   */
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const view = viewRef.current;
      if (!view) return;
      try {
        const lines = view.state.doc.lines;
        const line = Math.min(Math.max(activeLine || 0, 0), lines);
        const span = Math.min(Math.max(activeSpan || line, line), lines);
        const effects = [setActiveLine.of({ line, span })];
        // Follow the highlight during playback, but never yank the viewport out
        // from under someone who is mid-edit.
        if (line > 0 && Date.now() - lastEditRef.current > 1200) {
          effects.push(EditorView.scrollIntoView(view.state.doc.line(line).from, {
            y: 'center', yMargin: 80,
          }));
        }
        view.dispatch({ effects });
      } catch {
        /* The document moved on; the next update repaints the highlight. */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [activeLine, activeSpan, value]);

  return (
    <CodeMirror
      value={value}
      onChange={(next, update) => {
        lastEditRef.current = Date.now();
        onChange(next, update);
      }}
      extensions={extensions}
      theme={theme}
      editable={editable}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        highlightActiveLineGutter: false,
        autocompletion: true,
        bracketMatching: true,
        closeBrackets: true,
        searchKeymap: false,
      }}
      onCreateEditor={(view) => { viewRef.current = view; }}
      className="editor-surface"
    />
  );
}
