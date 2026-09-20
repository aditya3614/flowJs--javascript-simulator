/**
 * Runs user code and returns a scrubbable trace.
 *
 * Execution happens in an AsyncFunction so top-level `await` works, with the
 * real `console` shadowed by a shim that routes output into the trace. The
 * timer functions are shadowed too, so that anything the program leaves running
 * when it ends can be waited for briefly and then cancelled — otherwise a
 * `setInterval` would go on writing into a trace that is already on screen.
 *
 * This file only ever stops code that calls back into the tracer. Code stuck in
 * a built-in (a regular expression that backtracks forever, say) can only be
 * stopped from outside the thread, which is what `sandbox.js` is for.
 */

import { instrument } from './instrument.js';
import { Tracer, LIMITS } from './tracer.js';
import { snap, text } from './value.js';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Timer functions handed to the user's code. They behave normally, but every
 * live timer is tracked, an error inside a callback is reported rather than
 * left uncaught, and the tracer's own stop signal is swallowed quietly.
 */
function makeTimers(onError) {
  const live = new Set();
  const guard = (fn) => (...args) => {
    try { return fn(...args); } catch (err) {
      if (!(err && err.isLimit)) onError(err);
      return undefined;
    }
  };
  return {
    setTimeout(fn, ms, ...args) {
      if (typeof fn !== 'function') return setTimeout(fn, ms, ...args);
      const id = setTimeout(() => { live.delete(id); guard(fn)(...args); }, ms);
      live.add(id);
      return id;
    },
    setInterval(fn, ms, ...args) {
      if (typeof fn !== 'function') return setInterval(fn, ms, ...args);
      const id = setInterval(guard(fn), ms, ...args);
      live.add(id);
      return id;
    },
    clearTimeout(id) { live.delete(id); clearTimeout(id); },
    clearInterval(id) { live.delete(id); clearInterval(id); },
    pending: () => live.size,
    cancelAll() { live.forEach((id) => { clearTimeout(id); clearInterval(id); }); live.clear(); },
  };
}

/** Give timers left running at the end a short while to finish, then stop them. */
async function drain(tracer, timers) {
  // One turn of the event loop first. Work chained through promises runs ahead of
  // any timer, so this cannot resolve until such a chain has finished — or been
  // stopped by the tracer. Without it, an endless chain looks like a clean finish.
  await sleep(0);
  const end = performance.now() + LIMITS.drainMs;
  while (timers.pending() > 0 && !tracer.truncated && performance.now() < end) await sleep(10);
  if (timers.pending() > 0 && !tracer.truncated) tracer.timerCut = true;
  timers.cancelAll();
}

export async function run(source) {
  let instrumented;
  try {
    instrumented = instrument(source);
  } catch (err) {
    return {
      ok: false,
      frames: [],
      pipelines: [],
      output: [],
      error: {
        kind: 'syntax',
        name: 'SyntaxError',
        message: err.message.replace(/\s*\(\d+:\d+\)$/, ''),
        hint: /Unexpected token|Unexpected end of input/.test(err.message)
          ? 'A bracket, brace or quote is probably missing or unmatched.'
          : 'Check this line for a typo before running again.',
        line: err.loc ? err.loc.line : null,
        title: 'That code could not be read',
      },
    };
  }

  const tracer = new Tracer(instrumented.meta);
  const consoleShim = makeConsole(tracer);
  let timerError = null;
  const timers = makeTimers((err) => { if (!timerError) timerError = err; });

  let error = null;
  try {
    const fn = new AsyncFunction(
      '__T', 'console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
      `"use strict";\n${instrumented.code}`,
    );
    await fn(
      tracer.api, consoleShim,
      timers.setTimeout, timers.setInterval, timers.clearTimeout, timers.clearInterval,
    );
    tracer.flush();
  } catch (err) {
    // A stop signal has already been recorded on the tracer; anything else is
    // the program's own error.
    if (!(err && err.isLimit)) error = describeError(err, tracer);
  }

  // Timers the program left running: let them finish if they will, cancel if not.
  if (error) timers.cancelAll();
  else await drain(tracer, timers);
  if (!error && timerError) error = describeError(timerError, tracer);

  tracer.finishing = true;
  tracer.flush();

  if (error) {
    tracer.push({
      kind: 'error',
      line: error.line || (tracer.frames.length ? tracer.frames[tracer.frames.length - 1].line : 1),
      narr: `Something went wrong: ${error.message}`,
      force: true,
      message: error.message,
    });
  } else {
    const last = tracer.frames[tracer.frames.length - 1];
    let narr = 'All finished. That is the whole program.';
    if (tracer.timerCut) narr = 'The program itself finished, but a timer was still going, so it was stopped here.';
    else if (tracer.truncated) narr = 'Stopped early — this program runs for longer than the visualiser can replay in one go.';
    tracer.push({ kind: 'done', line: last ? last.line : 1, narr, force: true });
  }

  carryPipelines(tracer.frames);

  return {
    ok: !error,
    frames: tracer.frames,
    pipelines: tracer.pipelines,
    output: tracer.output,
    meta: instrumented.meta,
    truncated: banner(tracer),
    error,
    code: instrumented.code,
  };
}

/** The note shown under the diagram when a run did not end on its own. */
function banner(tracer) {
  if (tracer.timerCut) {
    return `A timer was still running when the program ended, so it was stopped after ${LIMITS.drainMs / 1000} seconds. A setInterval repeats forever unless something calls clearInterval.`;
  }
  if (tracer.truncated) {
    return `${tracer.truncated} Only the beginning is shown — if the program was never going to stop, check your loop's exit condition.`;
  }
  return null;
}

/** Console shim — captured output doubles as timeline frames. */
function makeConsole(tracer) {
  const write = (method) => (...args) => {
    if (tracer.finishing) return;   // the run is over; nothing may write into it
    const parts = args.map((a) => snap(a));
    tracer.output.push({ method, parts, line: null });
    tracer.push({
      kind: 'log',
      line: tracer.frames.length ? tracer.frames[tracer.frames.length - 1].line : 1,
      method,
      parts,
      force: true,
      narr: `Print {{${parts.map((p) => text(p)).join(' ')}}} to the console.`,
    });
  };
  return {
    log: write('log'), info: write('info'), warn: write('warn'),
    error: write('error'), debug: write('debug'), table: write('table'),
    trace: () => {}, group: () => {}, groupEnd: () => {}, dir: write('log'),
    time: () => {}, timeEnd: () => {}, assert: () => {}, count: () => {},
  };
}

/** Turn a thrown value into something a beginner can act on. */
function describeError(err, tracer) {
  const raw = err && err.message ? err.message : String(err);
  const last = tracer.frames[tracer.frames.length - 1];
  const hints = [
    [/is not a function/, 'You called something that is not a function — check the spelling, or whether that value is what you expect.'],
    [/is not defined/, 'That name has not been created yet. Check the spelling, or declare it before using it.'],
    [/Cannot read propert(y|ies)/, 'You reached into a value that is empty. Something further up returned undefined or null.'],
    [/is not iterable/, 'You tried to loop over something that is not a list. Check what that value actually holds.'],
    [/Unexpected token|Unexpected end of input/, 'A bracket, brace or quote is probably missing or unmatched.'],
    [/Invalid or unexpected token/, 'There is a stray character here that JavaScript cannot read.'],
    [/Assignment to constant/, 'A `const` box cannot be refilled. Use `let` if the value needs to change.'],
    [/Maximum call stack/, 'A function kept calling itself with no way out. Recursion needs a base case.'],
    [/before initialization/, 'You used a `let`/`const` variable above the line that creates it.'],
  ];
  const hint = hints.find(([re]) => re.test(raw));
  return {
    kind: 'runtime',
    name: (err && err.name) || 'Error',
    message: raw,
    hint: hint ? hint[1] : null,
    line: last ? last.line : null,
    title: 'The program stopped',
  };
}

/**
 * Pipeline state persists visually after its statement ends, so the finished
 * diagram stays on screen while later lines run.
 */
function carryPipelines(frames) {
  let last = null;
  for (const frame of frames) {
    if (frame.pipe) {
      last = frame.pipe;
    } else if (last) {
      frame.pipe = { ...last, stale: true };
    }
  }
}

export { LIMITS };
