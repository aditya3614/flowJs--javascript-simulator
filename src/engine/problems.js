/** A run that produced no trace, only a reason — in the same shape `run()` returns. */
export function failure({ kind, name, title, message, hint = null }) {
  return {
    ok: false,
    frames: [],
    pipelines: [],
    output: [],
    meta: [],
    truncated: null,
    code: '',
    error: { kind, name, title, message, hint, line: null },
  };
}
