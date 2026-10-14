import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { tokenStore } from '../api/tokenStore.js';
import { SESSION_EXPIRED_EVENT } from '../api/client.js';

vi.mock('../api/auth.js', () => ({ me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn().mockResolvedValue({}) }));
import * as authApi from '../api/auth.js';
const Probe = () => { const a = useAuth(); return <div><span data-testid="so">{String(a.signedOut)}</span><span data-testid="s">{a.status}</span><span data-testid="u">{a.user?.email ?? 'none'}</span><span data-testid="n">{a.notice}</span><button onClick={() => a.login('a@b.c', 'pw')}>login</button><button onClick={a.logout}>logout</button></div>; };
beforeEach(() => { tokenStore.clear(); vi.clearAllMocks(); });

describe('AuthContext', () => {
  it('starts anonymous without a token', () => { render(<AuthProvider><Probe /></AuthProvider>); expect(screen.getByTestId('s')).toHaveTextContent('anonymous'); });
  it('restores the session from the backend, not from the token alone', async () => {
    tokenStore.set('tok'); authApi.me.mockResolvedValue({ data: { user: { email: 'x@y.z', role: 'CUSTOMER' } } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('authenticated')); expect(screen.getByTestId('u')).toHaveTextContent('x@y.z');
  });
  it('drops an invalid stored token', async () => {
    tokenStore.set('bad'); authApi.me.mockRejectedValue(new Error('401'));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('anonymous')); expect(tokenStore.get()).toBeNull();
  });
  it('login stores the token; logout calls the API and clears it', async () => {
    authApi.login.mockResolvedValue({ data: { token: 'new', user: { email: 'a@b.c', role: 'ADMIN' } } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => { screen.getByText('login').click(); });
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('authenticated')); expect(tokenStore.get()).toBe('new');
    await act(async () => { screen.getByText('logout').click(); });
    expect(authApi.logout).toHaveBeenCalled(); expect(tokenStore.get()).toBeNull(); expect(screen.getByTestId('s')).toHaveTextContent('anonymous');
    expect(screen.getByTestId('so')).toHaveTextContent('true'); // deliberate log out is remembered
    await act(async () => { screen.getByText('login').click(); }); await waitFor(() => expect(screen.getByTestId('so')).toHaveTextContent('false'));
  });
  it('shows a message when the session expires', async () => {
    tokenStore.set('t'); authApi.me.mockResolvedValue({ data: { user: { email: 'x@y.z', role: 'CUSTOMER' } } });
    render(<AuthProvider><Probe /></AuthProvider>); await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('authenticated'));
    act(() => { window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { code: 'TOKEN_EXPIRED' } })); });
    expect(screen.getByTestId('s')).toHaveTextContent('anonymous'); expect(screen.getByTestId('n')).toHaveTextContent(/expired/); expect(screen.getByTestId('so')).toHaveTextContent('false'); // expiry is NOT a deliberate log out
  });
});
