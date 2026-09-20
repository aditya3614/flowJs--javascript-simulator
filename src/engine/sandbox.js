/**
 * Runs `run(source)` in a Web Worker and enforces a hard time limit.
 *
 * The tracer already stops anything that calls back into it — loops,
 * recursion, timers, promise chains — within milliseconds. What it cannot stop
 * is code stuck *inside* a built-in, such as a regular expression that
 * backtracks forever: nothing on the same thread ever gets a turn to interrupt
 * it. So the worker is killed from the outside instead.
 */

import { failure } from './problems.js';

// Must exceed the tracer's own budget (LIMITS.seconds + LIMITS.drainMs) so that
// an ordinary runaway program is stopped politely, with a partial trace, well
// before this fires.
export const HARD_LIMIT_MS = 6000;

export function runSandboxed(source) {
  return new Promise((resolve) => {
    let worker = null;
    let ready = false;
    let settled = false;
    let timer = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (worker) worker.terminate();   // also ends any timer or promise the program left behind
      resolve(result);
    };

    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    } catch (err) {
      finish(failure({
        kind: 'unavailable', name: 'Error', title: 'This browser cannot run code here',
        message: 'Could not start a background worker for your code.',
      }));
      return;
    }

    timer = setTimeout(() => finish(failure({
      kind: 'timeout',
      name: 'Timeout',
      title: 'The program got stuck',
      message: `It was still running after ${HARD_LIMIT_MS / 1000} seconds, so it was stopped.`,
      hint: 'That usually means something never finishes — a loop with no way out, or a regular expression that backtracks without end. Look for the condition that should make it stop.',
    })), HARD_LIMIT_MS);

    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'ready') { ready = true; worker.postMessage({ source }); }
      else if (m.type === 'result') finish(m.result);
    };

    // An uncaught error inside the program is reported by the runner; only a
    // failure to start at all should end the run here.
    worker.onerror = (e) => {
      e.preventDefault();
      if (!ready) {
        finish(failure({
          kind: 'unavailable', name: 'Error', title: 'This browser cannot run code here',
          message: e.message || 'The background worker failed to start.',
        }));
      }
    };
  });
}
