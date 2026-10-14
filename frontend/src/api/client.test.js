import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, clean, SESSION_EXPIRED_EVENT } from './client.js';
import { tokenStore } from './tokenStore.js';

const respond = (status, body) => async (config) => { const res = { data: body, status, statusText: '', headers: {}, config }; if (status >= 400) { const err = new Error('fail'); err.response = res; err.config = config; err.isAxiosError = true; throw err; } return res; };
beforeEach(() => { tokenStore.clear(); http.defaults.adapter = undefined; });

describe('axios client', () => {
  it('attaches the bearer token when signed in and omits it when not', async () => {
    let seen;
    http.defaults.adapter = async (config) => { seen = config.headers.Authorization; return { data: {}, status: 200, statusText: 'OK', headers: {}, config }; };
    await http.get('/x'); expect(seen).toBeUndefined();
    tokenStore.set('abc'); await http.get('/x'); expect(seen).toBe('Bearer abc');
  });
  it('ends the session once on an expired token', async () => {
    tokenStore.set('abc');
    const handler = vi.fn(); window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    http.defaults.adapter = respond(401, { success: false, error: { code: 'TOKEN_EXPIRED', message: 'expired' } });
    await expect(http.get('/x')).rejects.toBeTruthy();
    expect(tokenStore.get()).toBeNull(); expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  });
  it('does NOT end the session for ordinary 401 login failures or 403 permission errors', async () => {
    tokenStore.set('abc');
    http.defaults.adapter = respond(401, { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'bad' } });
    await expect(http.post('/auth/login')).rejects.toBeTruthy(); expect(tokenStore.get()).toBe('abc');
    http.defaults.adapter = respond(403, { success: false, error: { code: 'FORBIDDEN', message: 'no' } });
    await expect(http.get('/admin/dashboard')).rejects.toBeTruthy(); expect(tokenStore.get()).toBe('abc');
  });
  it('drops empty filters from query strings', () => { expect(clean({ q: '', status: 'PENDING', page: 1, x: undefined, y: null })).toEqual({ status: 'PENDING', page: 1 }); });
});
