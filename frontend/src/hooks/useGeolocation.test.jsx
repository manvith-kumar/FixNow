import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from './useGeolocation.js';

let ok, fail;
beforeEach(() => { vi.useFakeTimers(); Object.defineProperty(globalThis.navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (s, f) => { ok = s; fail = f; } } }); });
afterEach(() => { vi.useRealTimers(); });

describe('useGeolocation', () => {
  it('returns rounded coordinates when permission is granted', () => {
    const { result } = renderHook(() => useGeolocation()); act(() => result.current.request()); expect(result.current.loading).toBe(true);
    act(() => ok({ coords: { latitude: 16.30671234, longitude: 80.43654321 } })); expect(result.current.coords).toEqual({ latitude: 16.306712, longitude: 80.436543 }); expect(result.current.loading).toBe(false);
  });
  it('explains a declined permission without blocking anything', () => {
    const { result } = renderHook(() => useGeolocation()); act(() => result.current.request()); act(() => fail({ code: 1 }));
    expect(result.current.error).toMatch(/declined/); expect(result.current.coords).toBeNull();
  });
  it('stops spinning if the permission prompt is ignored, and still accepts a late answer', () => {
    const { result } = renderHook(() => useGeolocation()); act(() => result.current.request()); expect(result.current.loading).toBe(true);
    act(() => { vi.advanceTimersByTime(12001); }); expect(result.current.loading).toBe(false); expect(result.current.error).toMatch(/Still waiting/);
    act(() => ok({ coords: { latitude: 1, longitude: 2 } })); expect(result.current.coords).toEqual({ latitude: 1, longitude: 2 }); expect(result.current.error).toBe('');
  });
  it('reports unsupported browsers', () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', { configurable: true, value: undefined });
    const { result } = renderHook(() => useGeolocation()); act(() => result.current.request()); expect(result.current.error).toMatch(/does not support/);
  });
});
