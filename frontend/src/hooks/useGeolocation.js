import { useCallback, useEffect, useRef, useState } from 'react';

const PROMPT_FALLBACK_MS = 12000; // browsers do not start their own timeout until the permission prompt is answered

/** Optional browser geolocation. Always requires user permission; the app works without it. */
export function useGeolocation() {
  const [state, setState] = useState({ coords: null, loading: false, error: '' });
  const timer = useRef(null);
  const stop = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => stop, []);

  const request = useCallback(() => {
    stop();
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setState({ coords: null, loading: false, error: 'Your browser does not support location sharing. You can continue without it.' }); return; }
    setState({ coords: null, loading: true, error: '' });
    // If the person ignores the permission prompt nothing ever calls back: stop spinning and say so. A late answer is still accepted.
    timer.current = setTimeout(() => setState((s) => (s.loading ? { coords: null, loading: false, error: "Still waiting for your browser's location permission. You can continue without it, or try again." } : s)), PROMPT_FALLBACK_MS);
    navigator.geolocation.getCurrentPosition(
      (pos) => { stop(); setState({ coords: { latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)) }, loading: false, error: '' }); },
      (err) => { stop(); setState({ coords: null, loading: false, error: err.code === 1 ? 'Location permission was declined. That is fine, you can continue without it.' : 'Could not get your location. You can continue without it.' }); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }, []);
  const clear = useCallback(() => { stop(); setState({ coords: null, loading: false, error: '' }); }, []);
  return { ...state, request, clear };
}
