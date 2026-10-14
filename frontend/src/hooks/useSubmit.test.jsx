import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSubmit } from './useSubmit.js';

describe('useSubmit', () => {
  it('blocks duplicate submissions while one is running', async () => {
    let resolve; const action = vi.fn(() => new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useSubmit(action));
    let p1, p2;
    act(() => { p1 = result.current.run(); p2 = result.current.run(); });
    expect(action).toHaveBeenCalledTimes(1); expect(result.current.busy).toBe(true);
    await act(async () => { resolve('ok'); await p1; await p2; });
    expect(result.current.busy).toBe(false);
  });
  it('captures a readable error and field errors', async () => {
    const err = { response: { status: 400, data: { error: { code: 'VALIDATION_ERROR', message: 'x', details: [{ field: 'email', message: 'Bad email' }] } } } };
    const { result } = renderHook(() => useSubmit(async () => { throw err; }));
    await act(async () => { await result.current.run(); });
    expect(result.current.error).toContain('Bad email'); expect(result.current.fieldErrors.email).toBe('Bad email');
  });
});
