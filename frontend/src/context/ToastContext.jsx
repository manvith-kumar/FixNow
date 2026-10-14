import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const id = useRef(0);
  const dismiss = useCallback((tid) => setToasts((t) => t.filter((x) => x.id !== tid)), []);
  const push = useCallback((message, tone = 'ok') => {
    const tid = ++id.current;
    setToasts((t) => [...t.slice(-3), { id: tid, message, tone }]);
    setTimeout(() => dismiss(tid), tone === 'bad' ? 7000 : 4500);
  }, [dismiss]);
  const api = useMemo(() => ({ success: (m) => push(m, 'ok'), error: (m) => push(m, 'bad'), info: (m) => push(m, 'info') }), [push]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span>{t.message}</span>
            <button type="button" className="toast-close" aria-label="Dismiss message" onClick={() => dismiss(t.id)}>&times;</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => { const c = useContext(ToastContext); if (!c) throw new Error('useToast must be used inside ToastProvider'); return c; };
