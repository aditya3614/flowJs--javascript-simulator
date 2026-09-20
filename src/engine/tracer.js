/**
 * The tracer runtime.
 *
 * Instrumented code calls into `__T`. Every call may append a *frame* — one
 * scrubbable moment in the story — carrying the line, a plain-English
 * narration, the visible variables, the call stack and any pipeline progress.
 */

import { snap, text } from './value.js';

export const LIMITS = {
  frames: 3200,
  calls: 400000,
  stageItems: 100,
  comparisons: 60,
  seconds: 2,      // wall-clock budget for the program itself
  drainMs: 1500,   // how long to keep waiting for timers left running at the end
};

/** Thrown to stop a runaway program. `what` completes "this program …". */
class TraceLimit extends Error {
  constructor(what) {
    super(`Stopped early: this program ${what}.`);
    this.name = 'TraceLimit';
    this.isLimit = true;
  }
}

/* --------------------------------------------------------------- narration */

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
const ordinal = (n) => ORDINALS[n - 1] || `${n}th`;

/** Plain-language summary of what a traced method does to its input. */
const METHOD_STORY = {
  map: 'rebuilds the list, swapping each item for something new',
  filter: 'keeps only the items that pass a test',
  reduce: 'folds the whole list down into one value',
  reduceRight: 'folds the list into one value, starting from the end',
  forEach: 'visits every item in turn without building anything',
  sort: 'rearranges the items into order',
  toSorted: 'makes a new list with the items in order',
  some: 'asks "is at least one item like this?"',
  every: 'asks "are all the items like this?"',
  find: 'hunts for the first item that passes a test',
  findIndex: 'hunts for the position of the first matching item',
  findLast: 'hunts backwards for the last matching item',
  flatMap: 'maps each item, then flattens the results into one list',
  flat: 'unwraps nested lists into a single flat list',
  slice: 'takes a copy of one section of the list',
  concat: 'glues lists together',
  join: 'glues the items into a single string',
  reverse: 'flips the list back-to-front',
  toReversed: 'makes a new, flipped copy of the list',
  includes: 'asks "is this value in here?"',
  indexOf: 'asks "where does this value sit?"',
  push: 'adds to the end of the list',
  pop: 'removes the last item',
  shift: 'removes the first item',
  unshift: 'adds to the front of the list',
  splice: 'cuts items out of the middle',
  fill: 'overwrites a stretch of the list with one value',
  at: 'picks out the item at one position',
  split: 'chops a string into pieces',
  entries: 'pairs each item with its index',
  keys: 'lists the positions',
  values: 'lists the items',
};

/* ------------------------------------------------------------- the tracer */

export class Tracer {
  constructor(meta) {
    this.meta = meta;
    this.frames = [];
    this.output = [];
    this.pipelines = [];
    this.stack = [];
    this.calls = 0;
    this.truncated = null;
    this.result = undefined;

    this.pending = null;      // step waiting to be flushed or absorbed
    this.lastScope = {};      // most recent variable snapshot
    this.currentPipe = null;  // pipeline being built by the current statement
    this.quiet = 0;           // >0 while inside a one-line callback
    this.depth = 0;
    this.statementId = null;  // identity of the statement being executed
    this.finishing = false;   // true once execution has stopped
    this.deadline = performance.now() + LIMITS.seconds * 1000;
    this.stageDepth = 0;      // >0 while a traced method is running

    this.api = this.buildApi();
  }

  /* ------------------------------------------------------------ plumbing */

  m(metaId) { return this.meta[metaId] || {}; }

  /**
   * Record why the run was cut short and return the error that stops it.
   * Recording it here — not where it is caught — matters: it may be thrown from
   * a timer or a promise callback that nothing on the main path ever catches.
   */
  limit(what) {
    const err = new TraceLimit(what);
    if (!this.truncated) this.truncated = err.message;
    return err;
  }

  /**
   * Called on every statement, loop round, function entry and callback. Three
   * ways to be stopped: too many operations, too long, or — once either has
   * happened — anything at all. That last one is deliberate: a `try/catch` in
   * the user's code can swallow the first error, and without it the program
   * would simply carry on running.
   */
  budget() {
    if (this.truncated) throw new TraceLimit('was already stopped');
    if (++this.calls > LIMITS.calls) {
      throw this.limit(`produced more than ${LIMITS.calls.toLocaleString()} operations`);
    }
    // Reading the clock is cheap but not free; every 128th call is plenty.
    if ((this.calls & 127) === 0 && performance.now() > this.deadline) {
      throw this.limit(`ran for more than ${LIMITS.seconds} seconds`);
    }
  }

  push(frame) {
    if (this.quiet > 0 && !frame.force) return null;
    // Once the run is over, the closing frames are always allowed through —
    // otherwise hitting the limit would leave the trace without an ending.
    // Only the closing frames may go past the limit — never whatever a stray
    // timer or promise is still producing.
    if (this.frames.length >= LIMITS.frames && !(this.finishing && frame.force)) {
      throw this.limit(`produced more than ${LIMITS.frames.toLocaleString()} steps`);
    }
    const full = {
      i: this.frames.length,
      line: frame.line ?? 1,
      endLine: frame.endLine ?? frame.line ?? 1,
      scope: frame.scope || this.lastScope,
      stack: this.stack.map((f) => ({ name: f.name, args: f.args, line: f.line, id: f.id, ret: f.ret })),
      outLen: this.output.length,
      depth: this.stack.length,
      pipe: frame.pipe || null,
      ...frame,
    };
    this.frames.push(full);
    return full;
  }

  /** Emit the waiting step frame, if one is still outstanding. */
  flush() {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    const meta = this.m(p.metaId);
    this.push({
      kind: 'step',
      metaId: p.metaId,
      line: meta.line,
      endLine: meta.endLine,
      scope: p.scope,
      narr: describeStep(meta),
    });
  }

  /** Take over the waiting step frame so one line yields one moment. */
  absorb() {
    const p = this.pending;
    this.pending = null;
    return p;
  }

  readScope(fn) {
    if (typeof fn !== 'function') return this.lastScope;
    try {
      const raw = fn();
      const out = {};
      for (const key of Object.keys(raw)) out[key] = snap(raw[key]);
      this.lastScope = out;
      return out;
    } catch {
      return this.lastScope;
    }
  }

  /* ------------------------------------------------------- instrumentation */

  buildApi() {
    const t = this;
    return {
      /* statement boundary */
      s(metaId, scopeFn) {
        t.budget();
        t.flush();
        // Statements running inside a callback belong to the statement that
        // started the chain, so the whole chain stays one pipeline.
        if (t.stageDepth === 0) t.statementId = `${metaId}:${t.calls}`;
        t.pending = { metaId, scope: t.readScope(scopeFn) };
      },

      /* variable declaration with a simple name */
      d(metaId, name, value) {
        const meta = t.m(metaId);
        const held = t.absorb();
        const v = snap(value);
        t.lastScope = { ...(held ? held.scope : t.lastScope), [name]: v };
        t.push({
          kind: 'decl',
          metaId,
          line: meta.line,
          endLine: meta.endLine,
          name,
          value: v,
          varKind: meta.kind,
          scope: t.lastScope,
          narr: `Make a new box called \`${name}\` and put {{${text(v)}}} inside.`,
        });
        return value;
      },

      /* destructuring declaration */
      dp(metaId, bindings) {
        const meta = t.m(metaId);
        const held = t.absorb();
        const values = {};
        for (const key of Object.keys(bindings)) values[key] = snap(bindings[key]);
        t.lastScope = { ...(held ? held.scope : t.lastScope), ...values };
        const names = Object.keys(values);
        t.push({
          kind: 'decl',
          metaId,
          line: meta.line,
          endLine: meta.endLine,
          name: names.join(', '),
          value: values[names[0]],
          unpacked: values,
          scope: t.lastScope,
          narr: `Unpack ${names.length} value${names.length === 1 ? '' : 's'} into ${names.map((n) => `\`${n}\``).join(', ')}.`,
        });
      },

      /* assignment to a plain variable */
      a(metaId, name, before, after, read) {
        const meta = t.m(metaId);
        const held = t.absorb();
        let now;
        try { now = read(); } catch { now = after; }
        const prev = snap(before);
        const next = snap(now);
        t.lastScope = { ...(held ? held.scope : t.lastScope), [name]: next };
        t.push({
          kind: 'assign',
          metaId,
          line: meta.line,
          endLine: meta.endLine,
          name,
          prev,
          value: next,
          scope: t.lastScope,
          narr: `\`${name}\` changes from {{${text(prev)}}} to {{${text(next)}}}.`,
        });
        return after;
      },

      /* assignment into an object or array slot */
      am(metaId, after, read) {
        const meta = t.m(metaId);
        const held = t.absorb();
        let rootVal;
        try { rootVal = read ? read() : undefined; } catch { rootVal = undefined; }
        const next = snap(rootVal);
        if (meta.root) t.lastScope = { ...(held ? held.scope : t.lastScope), [meta.root]: next };
        t.push({
          kind: 'assign',
          metaId,
          line: meta.line,
          endLine: meta.endLine,
          name: meta.name,
          value: snap(after),
          container: meta.root ? { name: meta.root, value: next } : null,
          scope: t.lastScope,
          narr: `Store {{${text(snap(after))}}} into \`${meta.name}\`.`,
        });
        return after;
      },

      /* ++ / -- */
      u(metaId, name, result, read) {
        const meta = t.m(metaId);
        const held = t.absorb();
        let now;
        try { now = read(); } catch { now = result; }
        const next = snap(now);
        t.lastScope = { ...(held ? held.scope : t.lastScope), [name]: next };
        t.push({
          kind: 'assign',
          metaId,
          line: meta.line,
          endLine: meta.endLine,
          name,
          value: next,
          scope: t.lastScope,
          narr: `\`${name}\` is now {{${text(next)}}}.`,
        });
        return result;
      },

      /* if / while / ternary / switch test */
      cond(metaId, value) {
        const meta = t.m(metaId);
        const truthy = !!value;

        // Loop headers are narrated by their iteration frames instead — except
        // for the final check that ends the loop.
        if ((meta.kind === 'for' || meta.kind === 'while') && truthy) {
          return value;
        }
        const held = t.absorb();
        const scope = held ? held.scope : t.lastScope;

        let narr;
        if (meta.kind === 'switch') {
          narr = `Look at \`${meta.text}\` — it is {{${text(snap(value))}}}. Which case matches?`;
        } else if (meta.kind === 'for' || meta.kind === 'while') {
          narr = `Check \`${meta.text}\` → {{false}}. The loop is finished.`;
        } else {
          narr = `Check \`${meta.text}\` → {{${truthy}}}, so ${truthy ? 'we go inside' : 'we skip this'}.`;
        }
        t.push({
          kind: meta.kind === 'switch' ? 'switch' : 'cond',
          metaId,
          line: meta.line,
          endLine: meta.endLine,
          test: meta.text,
          truthy,
          value: snap(value),
          condKind: meta.kind,
          scope,
          narr,
        });
        return value;
      },

      /* top of a loop body */
      iter(metaId, scopeFn) {
        t.budget();
        t.flush();
        const meta = t.m(metaId);
        const scope = t.readScope(scopeFn);
        const key = `loop:${metaId}:${t.stack.length}`;
        t.loopCounts = t.loopCounts || {};
        t.loopCounts[key] = (t.loopCounts[key] || 0) + 1;
        const n = t.loopCounts[key];

        const loopVars = (meta.vars || []).filter((v) => scope[v] !== undefined);
        const detail = loopVars.length
          ? ` ${loopVars.map((v) => `\`${v}\` is {{${text(scope[v])}}}`).join(', ')}.`
          : '';
        t.push({
          kind: 'iter',
          metaId,
          line: meta.line,
          endLine: meta.line,
          iteration: n,
          loopKind: meta.kind,
          scope,
          narr: `${ordinal(n)} time round the loop.${detail}`,
        });
      },

      /* function call entry */
      enter(metaId, params) {
        t.budget();
        t.flush();
        const meta = t.m(metaId);
        const args = {};
        for (const key of Object.keys(params)) args[key] = snap(params[key]);
        const frame = {
          id: `${metaId}:${t.calls}`,
          name: meta.name || 'anonymous',
          args,
          line: meta.line,
          metaId,
          ret: undefined,
          quiet: t.quiet > 0,
        };
        t.stack.push(frame);
        const argText = Object.entries(args).map(([k, v]) => `${k} = ${text(v)}`).join(', ');
        t.push({
          kind: 'enter',
          metaId,
          line: meta.line,
          endLine: meta.line,
          fnName: frame.name,
          args,
          scope: { ...args },
          narr: `Step into \`${frame.name}\`${argText ? ` with ${argText}` : ' with no inputs'}.`,
        });
        t.lastScope = { ...args };
      },

      /* record a return value; the exit frame reports it */
      ret(metaId, value) {
        const top = t.stack[t.stack.length - 1];
        const meta = t.m(metaId);
        if (top) { top.ret = snap(value); top.retLine = meta.line; top.returned = true; }
        return value;
      },

      /* function call exit */
      exit(metaId) {
        const frame = t.stack.pop();
        if (!frame) return;
        t.flush();
        const meta = t.m(metaId);
        const value = frame.ret;
        const caller = t.stack[t.stack.length - 1];
        t.push({
          kind: 'exit',
          metaId,
          line: frame.retLine || meta.endLine || meta.line,
          endLine: frame.retLine || meta.endLine || meta.line,
          fnName: frame.name,
          value,
          scope: t.lastScope,
          narr: frame.returned
            ? `\`${frame.name}\` hands back {{${text(value)}}}${caller ? ` to \`${caller.name}\`` : ''}.`
            : `\`${frame.name}\` finishes without handing anything back.`,
        });
      },

      /* console.* */
      log(metaId, method, args) {
        const meta = t.m(metaId);
        const held = t.absorb();
        const parts = args.map((a) => snap(a));
        t.output.push({ method, parts, line: meta.line });
        t.push({
          kind: 'log',
          metaId,
          line: meta.line,
          endLine: meta.endLine,
          method,
          parts,
          scope: held ? held.scope : t.lastScope,
          force: true,
          narr: `Print {{${parts.map((p) => text(p)).join(' ')}}} to the console.`,
        });
        return undefined;
      },

      /* traced array / string method */
      c(metaId, receiver, method, args) {
        return t.stage(metaId, receiver, method, args);
      },
    };
  }

  /* ------------------------------------------------------------ pipelines */

  /** Run a traced method, recording it as an animated pipeline stage. */
  stage(metaId, receiver, method, args) {
    const meta = this.m(metaId);
    this.budget();

    if (receiver == null || typeof receiver[method] !== 'function') {
      return receiver[method](...args); // let JS raise its own error
    }

    this.flush();

    if (!this.currentPipe || this.currentPipe.statement !== this.statementId) {
      this.currentPipe = { id: this.pipelines.length, statement: this.statementId, stages: [] };
      this.pipelines.push(this.currentPipe);
    }
    const pipe = this.currentPipe;
    const stage = {
      index: pipe.stages.length,
      method,
      meta,
      label: method,
      body: meta.body,
      params: meta.params || [],
      input: snap(receiver),
      inputIsList: Array.isArray(receiver),
      args: args.filter((a) => typeof a !== 'function').map((a) => snap(a)),
      items: [],
      output: null,
      done: false,
      truncated: false,
      story: METHOD_STORY[method] || 'transforms the value',
    };
    pipe.stages.push(stage);

    const at = (item = -1, phase = 'run') => ({ pid: pipe.id, si: stage.index, item, phase });

    this.push({
      kind: 'stage-start',
      metaId,
      line: meta.line,
      endLine: meta.endLine,
      method,
      pipe: at(-1, 'start'),
      narr: `\`${method}\` ${stage.story}. Starting with {{${text(stage.input)}}}.`,
    });

    const isList = Array.isArray(receiver);
    const wrapped = isList
      ? args.map((a, i) => this.wrapCallback(a, i, method, stage, at, metaId, receiver))
      : args;

    let result;
    this.stageDepth++;
    try {
      result = receiver[method](...wrapped);
    } catch (err) {
      stage.done = true;
      stage.error = String(err && err.message ? err.message : err);
      throw err;
    } finally {
      this.stageDepth--;
    }

    stage.output = snap(result);
    stage.done = true;
    this.push({
      kind: 'stage-end',
      metaId,
      line: meta.line,
      endLine: meta.endLine,
      method,
      value: stage.output,
      pipe: at(stage.items.length - 1, 'end'),
      narr: `\`${method}\` is done — the result is {{${text(stage.output)}}}.`,
    });
    return result;
  }

  /** Wrap a user callback so every invocation becomes a visible item. */
  wrapCallback(fn, argIndex, method, stage, at, metaId, receiver) {
    if (typeof fn !== 'function') return fn;
    const t = this;
    const meta = this.m(metaId);
    const quiet = meta.simple;

    if (method === 'sort' || method === 'toSorted') {
      stage.mode = 'compare';
      return function tracedCompare(a, b) {
        t.budget();
        if (quiet) t.quiet++;
        let r;
        try { r = fn.apply(this, arguments); } finally { if (quiet) t.quiet--; }
        if (stage.items.length < LIMITS.comparisons) {
          const item = {
            kind: 'compare',
            a: snap(a),
            b: snap(b),
            result: snap(r),
            order: r <= 0 ? 'keep' : 'swap',
            // The array as it stands right now — sorting is easiest to follow
            // when you watch the list itself shuffle.
            state: snap(receiver),
          };
          stage.items.push(item);
          // `sort` reorders in place, so the variable itself has changed.
          if (meta.sourceName) t.lastScope = { ...t.lastScope, [meta.sourceName]: item.state };
          t.push({
            kind: 'stage-item',
            metaId,
            line: meta.line,
            endLine: meta.endLine,
            method,
            pipe: at(stage.items.length - 1, 'item'),
            narr: `Compare {{${text(item.a)}}} with {{${text(item.b)}}} → ${r <= 0 ? `{{${text(item.a)}}} stays in front` : `{{${text(item.b)}}} moves in front`}.`,
          });
        } else {
          stage.truncated = true;
        }
        return r;
      };
    }

    if (method === 'reduce' || method === 'reduceRight') {
      if (argIndex !== 0) return fn;
      stage.mode = 'fold';
      return function tracedReducer(acc, value, index) {
        t.budget();
        if (quiet) t.quiet++;
        let r;
        try { r = fn.apply(this, arguments); } finally { if (quiet) t.quiet--; }
        if (stage.items.length < LIMITS.stageItems) {
          const item = { kind: 'fold', index, value: snap(value), acc: snap(acc), result: snap(r) };
          stage.items.push(item);
          t.push({
            kind: 'stage-item',
            metaId,
            line: meta.line,
            endLine: meta.endLine,
            method,
            pipe: at(stage.items.length - 1, 'item'),
            narr: `Running total {{${text(item.acc)}}} meets {{${text(item.value)}}} → {{${text(item.result)}}}.`,
          });
        } else {
          stage.truncated = true;
        }
        return r;
      };
    }

    if (argIndex !== 0) return fn;

    const PREDICATE = new Set(['filter', 'some', 'every', 'find', 'findIndex', 'findLast']);
    stage.mode = PREDICATE.has(method) ? 'test' : 'transform';

    return function tracedCallback(value, index) {
        t.budget();
      if (quiet) t.quiet++;
      let r;
      try { r = fn.apply(this, arguments); } finally { if (quiet) t.quiet--; }
      if (stage.items.length < LIMITS.stageItems) {
        const kept = !!r;
        const item = {
          kind: stage.mode,
          index,
          value: snap(value),
          result: snap(r),
          kept: PREDICATE.has(method) ? kept : true,
        };
        stage.items.push(item);
        t.push({
          kind: 'stage-item',
          metaId,
          line: meta.line,
          endLine: meta.endLine,
          method,
          pipe: at(stage.items.length - 1, 'item'),
          narr: describeItem(method, item, stage),
        });
      } else {
        stage.truncated = true;
      }
      return r;
    };
  }
}

/* -------------------------------------------------------------- narration */

function describeStep(meta) {
  const code = (meta.text || '').replace(/;$/, '');
  switch (meta.type) {
    case 'IfStatement': return 'Time to make a decision.';
    case 'ForStatement':
    case 'ForOfStatement':
    case 'ForInStatement':
    case 'WhileStatement': return 'Set up the loop.';
    case 'ReturnStatement': {
      const expr = (meta.text || '').replace(/^return\s*/, '').replace(/;$/, '').trim();
      return expr
        ? `Work out \`${expr}\` — that is the answer to hand back.`
        : 'Leave the function now.';
    }
    case 'ExpressionStatement': return `Run \`${code}\`.`;
    case 'ThrowStatement': return 'Raise an error.';
    case 'TryStatement': return 'Try this, and catch anything that goes wrong.';
    case 'VariableDeclaration': return `Work out \`${code}\`.`;
    default: return `Run \`${code}\`.`;
  }
}

function describeItem(method, item, stage) {
  const v = text(item.value);
  const r = text(item.result);
  const test = stage.body ? `\`${stage.body}\`` : 'the test';
  switch (method) {
    case 'map':
    case 'flatMap':
      return `Take {{${v}}} and turn it into {{${r}}}.`;
    case 'filter':
      return item.kept
        ? `Does {{${v}}} pass ${test}? Yes — keep it.`
        : `Does {{${v}}} pass ${test}? No — drop it.`;
    case 'find':
    case 'findLast':
      return item.kept ? `{{${v}}} matches — this is the one.` : `{{${v}}} does not match, keep looking.`;
    case 'findIndex':
      return item.kept ? `{{${v}}} matches — remember its position.` : `{{${v}}} does not match, keep looking.`;
    case 'some':
      return item.kept ? `{{${v}}} passes — that is enough, the answer is yes.` : `{{${v}}} does not pass, try the next one.`;
    case 'every':
      return item.kept ? `{{${v}}} passes, so far so good.` : `{{${v}}} fails — the answer is no.`;
    case 'forEach':
      return `Visit {{${v}}}.`;
    default:
      return `{{${v}}} → {{${r}}}.`;
  }
}

export { TraceLimit };
