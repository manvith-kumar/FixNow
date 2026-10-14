import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { useFetch } from './useFetch.js';
import { Async } from '../components/ui/Feedback.jsx';

describe('useFetch', () => {
  it('loads data and exposes meta', async () => {
    const { result } = renderHook(() => useFetch(async () => ({ data: [1, 2], meta: { total: 2 } })));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([1, 2]); expect(result.current.meta.total).toBe(2);
  });
  it('REGRESSION: reports loading (never "idle with null data") in the render where `enabled` flips to true', async () => {
    const seen = [];
    const { result, rerender } = renderHook(({ on }) => { const r = useFetch(async () => ({ data: [1] }), [on], { enabled: on }); seen.push({ enabled: on, loading: r.loading, data: r.data }); return r; }, { initialProps: { on: false } });
    expect(result.current.loading).toBe(false); // genuinely idle while disabled
    rerender({ on: true });
    const firstEnabledRender = seen.find((s) => s.enabled);
    expect(firstEnabledRender.loading).toBe(true); // the render that used to crash pages (loading=false, data=null)
    await waitFor(() => expect(result.current.data).toEqual([1]));
  });
  it('ignores a stale response when the dependencies change', async () => {
    let resolveFirst; const calls = [];
    const fn = (arg) => new Promise((r) => { calls.push(arg); if (arg === 'a') resolveFirst = () => r({ data: 'A' }); else r({ data: 'B' }); });
    const { result, rerender } = renderHook(({ k }) => useFetch(() => fn(k), [k]), { initialProps: { k: 'a' } });
    rerender({ k: 'b' }); await waitFor(() => expect(result.current.data).toBe('B'));
    await act(async () => { resolveFirst(); }); expect(result.current.data).toBe('B');
  });
});

describe('Async', () => {
  it('never calls its render callback with null data while a fetch has not started', () => {
    let called = false;
    render(<Async state={{ data: null, loading: false, error: null, reload: () => {} }}>{() => { called = true; return <p>content</p>; }}</Async>);
    expect(called).toBe(false); expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });
  it('renders content once data exists', () => {
    render(<Async state={{ data: ['x'], loading: false, error: null, reload: () => {} }}>{(rows) => <p>{rows.length} row</p>}</Async>);
    expect(screen.getByText('1 row')).toBeInTheDocument();
  });
});
