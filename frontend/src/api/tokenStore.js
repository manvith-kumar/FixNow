// The JWT is a session credential, not business data. It is kept in sessionStorage (cleared when the tab closes)
// and falls back to memory where sessionStorage is unavailable (tests, privacy modes). All users, bookings,
// quotations, payments and reviews always come from the backend.
const KEY = 'fixnow.session';
let memory = null;
const storage = () => { try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; } };

export const tokenStore = {
  get() { const s = storage(); return s ? s.getItem(KEY) : memory; },
  set(token) { const s = storage(); if (s) s.setItem(KEY, token); else memory = token; },
  clear() { const s = storage(); if (s) s.removeItem(KEY); memory = null; },
};
