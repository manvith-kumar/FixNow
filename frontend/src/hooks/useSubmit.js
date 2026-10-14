import { useCallback, useRef, useState } from 'react';
import { getErrorMessage, getFieldErrors } from '../utils/errors.js';

/**
 * Wraps an async action so it cannot be fired twice while running (prevents duplicate bookings/payments from double clicks).
 * Returns { run, busy, error, fieldErrors, clearError }. `run` resolves to the result or undefined when it failed.
 */
export function useSubmit(action) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const lock = useRef(false);
  const run = useCallback(async (...args) => {
    if (lock.current) return undefined;
    lock.current = true; setBusy(true); setError(''); setFieldErrors({});
    try { return await action(...args); }
    catch (err) { setError(getErrorMessage(err)); setFieldErrors(getFieldErrors(err)); return undefined; }
    finally { lock.current = false; setBusy(false); }
  }, [action]);
  return { run, busy, error, fieldErrors, clearError: () => { setError(''); setFieldErrors({}); } };
}
