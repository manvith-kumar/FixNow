// Display-only formatting. Amounts arrive from the backend as exact decimal strings and are never recalculated here.
export function formatMoney(value, currency = 'INR') {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** MySQL DATETIME strings (UTC, "YYYY-MM-DD HH:mm:ss") -> local date and time. */
export function parseUtc(value) {
  if (!value) return null;
  const s = String(value);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function formatDateTime(value) {
  const d = parseUtc(value);
  return d ? d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-';
}
/** Date-only values (preferred date, validity) are shown as the calendar date they are, with no timezone shift. */
export function formatDate(value) {
  if (!value) return '-';
  const s = String(value).slice(0, 10);
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function formatTime(value) {
  if (!value) return '-';
  const [h, m] = String(value).split(':');
  const d = new Date(2000, 0, 1, Number(h), Number(m));
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}
export const timeAgo = (value) => {
  const d = parseUtc(value);
  if (!d) return '';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return formatDate(d.toISOString());
};
export const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const addDaysIso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const humanize = (s) => (s ? String(s).replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : '');
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
