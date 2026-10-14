import axios from 'axios';
import { env } from '../config/env.js';
import { tokenStore } from './tokenStore.js';

export const SESSION_EXPIRED_EVENT = 'fixnow:session-expired';

export const http = axios.create({ baseURL: env.apiBaseUrl, timeout: 20000, headers: { Accept: 'application/json' } });

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An authenticated request that comes back as an invalid/expired token or a disabled account ends the session once, consistently.
const SESSION_ENDING = new Set(['TOKEN_EXPIRED', 'INVALID_TOKEN', 'ACCOUNT_DISABLED']);
http.interceptors.response.use(
  (res) => res,
  (error) => {
    const code = error.response?.data?.error?.code;
    if (tokenStore.get() && SESSION_ENDING.has(code) && typeof window !== 'undefined') {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { code } }));
    }
    return Promise.reject(error);
  },
);

/** Every API function resolves to the backend envelope: { success, data, meta? }. */
export const get = (url, params) => http.get(url, { params: clean(params) }).then((r) => r.data);
export const post = (url, body, config) => http.post(url, body, config).then((r) => r.data);
export const put = (url, body) => http.put(url, body).then((r) => r.data);
export const patch = (url, body) => http.patch(url, body).then((r) => r.data);
export const del = (url) => http.delete(url).then((r) => r.data);

/** Drop empty filters so they are not sent as `?q=`. */
export function clean(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null));
}
