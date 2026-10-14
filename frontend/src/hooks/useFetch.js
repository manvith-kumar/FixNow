import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data from an API function. Re-runs when `deps` change; `reload()` forces a refresh. Ignores stale responses.
 * `enabled: false` defers the request (for example until a profile says the user is approved).
 * IMPORTANT: in the render where `enabled` flips to true the request has not started yet, so `loading` is reported as true
 * (derived below). Reporting `loading: false, data: null` there made pages call their render callbacks with null data.
 */
export function useFetch(fn, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, meta: null, loading: enabled, error: null, started: false });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null, started: true }));
    try {
      const res = await fnRef.current();
      if (id === seq.current) setState({ data: res?.data ?? null, meta: res?.meta ?? null, loading: false, error: null, started: true });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ ...s, loading: false, error, started: true }));
    }
  }, []);

  useEffect(() => {
    if (enabled) run(); else setState((s) => ({ ...s, loading: false }));
    // Bump the sequence on cleanup / dependency change so a late response from the old request is ignored.
    return () => { seq.current += 1; };
    // `run` is stable (useCallback with no deps); `deps` is the caller-controlled refetch trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const loading = state.loading || (enabled && !state.started && !state.error && state.data === null);
  return { data: state.data, meta: state.meta, error: state.error, loading, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}
