import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth.js';
import { tokenStore } from '../api/tokenStore.js';
import { SESSION_EXPIRED_EVENT } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(tokenStore.get() ? 'loading' : 'anonymous'); // loading | authenticated | anonymous
  const [notice, setNotice] = useState('');
  const [signedOut, setSignedOut] = useState(false); // true after a deliberate log out (so route guards send people home, not to /login)

  // Restore the session from the backend (the token alone is never trusted: role/status come from /auth/me).
  useEffect(() => {
    let alive = true;
    if (!tokenStore.get()) return undefined;
    authApi.me().then((res) => { if (alive) { setUser(res.data.user); setStatus('authenticated'); } })
      .catch(() => { if (alive) { tokenStore.clear(); setUser(null); setStatus('anonymous'); } });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onExpired = (e) => {
      setUser(null); setStatus('anonymous');
      setNotice(e.detail?.code === 'ACCOUNT_DISABLED' ? 'This account has been disabled.' : 'Your session has expired. Please log in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const startSession = useCallback((res) => {
    tokenStore.set(res.data.token); setUser(res.data.user); setStatus('authenticated'); setNotice(''); setSignedOut(false);
    return res.data.user;
  }, []);
  const login = useCallback(async (email, password) => startSession(await authApi.login({ email, password })), [startSession]);
  const register = useCallback(async (body) => startSession(await authApi.register(body)), [startSession]);
  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* token may already be invalid; still end the local session */ }
    tokenStore.clear(); setUser(null); setStatus('anonymous'); setNotice(''); setSignedOut(true);
  }, []);
  const refreshUser = useCallback(async () => { const res = await authApi.me(); setUser(res.data.user); return res.data.user; }, []);
  const replaceToken = useCallback((token) => tokenStore.set(token), []);

  const value = useMemo(() => ({ user, status, notice, signedOut, clearNotice: () => setNotice(''), isAuthenticated: status === 'authenticated', login, register, logout, refreshUser, replaceToken, setUser }),
    [user, status, notice, signedOut, login, register, logout, refreshUser, replaceToken]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => { const c = useContext(AuthContext); if (!c) throw new Error('useAuth must be used inside AuthProvider'); return c; };
