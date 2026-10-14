import { describe, it, expect } from 'vitest';
import { getErrorMessage, getFieldErrors, getErrorCode } from './errors.js';

const apiError = (status, error) => ({ response: { status, data: { success: false, error } } });
describe('error helpers', () => {
  it('uses the backend message', () => { expect(getErrorMessage(apiError(409, { code: 'ALREADY_PAID', message: 'This booking has already been paid' }))).toBe('This booking has already been paid'); });
  it('turns validation details into readable text and field errors', () => {
    const e = apiError(400, { code: 'VALIDATION_ERROR', message: 'Validation failed', details: [{ field: 'items.0.unitPrice', message: 'Invalid' }, { field: 'email', message: 'Invalid email' }] });
    expect(getErrorMessage(e)).toContain('Email: Invalid email');
    expect(getFieldErrors(e)).toEqual({ 'items.0.unitPrice': 'Invalid', email: 'Invalid email' });
    expect(getErrorCode(e)).toBe('VALIDATION_ERROR');
  });
  it('hides server internals for 5xx', () => { expect(getErrorMessage(apiError(500, { code: 'INTERNAL_ERROR', message: 'SQL syntax error near ...' }))).not.toMatch(/SQL/); });
  it('explains network failures', () => { expect(getErrorMessage({ message: 'Network Error' })).toMatch(/Cannot reach the FixNow server/); });
});
