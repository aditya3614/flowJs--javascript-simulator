/**
 * The worker that actually runs the user's code.
 *
 * Running here rather than on the page does two things. The page stays
 * responsive whatever the code does, and the code cannot reach the page: no
 * `document`, no `window`, no `localStorage`. `sandbox.js` can also kill this
 * thread from outside if it never comes back.
 */

import { run } from './run.js';
import { failure } from './problems.js';

// The tracer stops a runaway program by throwing. When that happens inside a
// promise nothing catches it, so tell the worker it is expected.
self.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.isLimit) e.preventDefault();
});

self.onmessage = async (e) => {
  let result;
  try {
    result = await run(e.data.source);
  } catch (err) {
    result = failure({
      kind: 'internal', name: 'Error', title: 'Something went wrong',
      message: String((err && err.message) || err),
    });
  }

  try {
    self.postMessage({ type: 'result', result });
  } catch {
    // A trace that cannot be copied across (it should always be plain data).
    self.postMessage({
      type: 'result',
      result: failure({
        kind: 'internal', name: 'Error', title: 'Something went wrong',
        message: 'The result of this program could not be sent back to the page.',
      }),
    });
  }
};

self.postMessage({ type: 'ready' });
