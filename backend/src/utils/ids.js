import crypto from 'node:crypto';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function bookingReference(date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replaceAll('-', '');
  let suffix = '';
  const bytes = crypto.randomBytes(6);
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  return `FN-${ymd}-${suffix}`;
}
export const transactionReference = () => `SIM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
export const randomToken = () => crypto.randomBytes(32).toString('hex');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
