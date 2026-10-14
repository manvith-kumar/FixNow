import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate, formatTime, parseUtc, humanize, initials, formatDateTime } from './format.js';

describe('format utils', () => {
  it('formats backend decimal strings as INR without recalculating', () => {
    expect(formatMoney('872.61')).toContain('872.61');
    expect(formatMoney('872.61')).toMatch(/₹/);
    expect(formatMoney('1234567.5')).toContain('12,34,567.50');
    expect(formatMoney(null)).toBe('-');
  });
  it('shows date-only values without timezone shifting', () => {
    expect(formatDate('2026-03-05')).toContain('5');
    expect(formatDate('2026-03-05')).toContain('2026');
    expect(formatDate('2026-03-05 23:59:59')).toContain('5');
    expect(formatDate(null)).toBe('-');
  });
  it('treats MySQL DATETIME strings as UTC', () => {
    expect(parseUtc('2026-01-01 00:00:00').toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(parseUtc('garbage')).toBeNull();
    expect(formatDateTime('nope')).toBe('-');
  });
  it('formats times and helper strings', () => {
    expect(formatTime('14:30')).toMatch(/2:30/);
    expect(humanize('QUOTATION_SENT')).toBe('Quotation sent');
    expect(initials('Demo Customer')).toBe('DC');
  });
});
