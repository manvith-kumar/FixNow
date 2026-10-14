import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as notificationsApi from '../api/notifications.js';
import { useAuth } from './AuthContext.jsx';

const Ctx = createContext({ unread: 0, refresh: () => {} });
/** Keeps the unread badge in sync with the backend (polls every 60s; pages call refresh() after reading). */
export function NotificationsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [unread, setUnread] = useState(0);
  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try { const res = await notificationsApi.list({ page: 1, pageSize: 1 }); setUnread(res.meta?.unread ?? 0); } catch { /* badge is best-effort */ }
  }, [isAuthenticated]);
  useEffect(() => { refresh(); if (!isAuthenticated) return undefined; const t = setInterval(refresh, 60000); return () => clearInterval(t); }, [refresh, isAuthenticated]);
  const value = useMemo(() => ({ unread, refresh }), [unread, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useUnread = () => useContext(Ctx);
