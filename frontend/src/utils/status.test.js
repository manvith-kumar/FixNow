import { describe, it, expect } from 'vitest';
import { BOOKING_STATUS, CUSTOMER_CANCELLABLE, ADMIN_CANCELLABLE, QUOTE_STATUS, homeFor } from './status.js';
// CONTRACT: the frontend's status rules must match the backend state machine exactly.
import { TRANSITIONS, canTransition } from '../../../backend/src/utils/bookingStateMachine.js';

describe('status vocabulary matches the backend', () => {
  it('knows every backend booking status and nothing else', () => { expect(Object.keys(BOOKING_STATUS).sort()).toEqual(Object.keys(TRANSITIONS).sort()); });
  it('customer-cancellable states equal the backend rule', () => {
    const backend = Object.keys(TRANSITIONS).filter((s) => canTransition(s, 'CANCELLED', 'CUSTOMER'));
    expect([...CUSTOMER_CANCELLABLE].sort()).toEqual(backend.sort());
  });
  it('admin-cancellable states equal the backend rule', () => {
    const backend = Object.keys(TRANSITIONS).filter((s) => canTransition(s, 'CANCELLED', 'ADMIN'));
    expect([...ADMIN_CANCELLABLE].sort()).toEqual(backend.sort());
  });
  it('quotation statuses and role homes', () => {
    expect(Object.keys(QUOTE_STATUS).sort()).toEqual(['APPROVED', 'PENDING', 'REJECTED', 'SUPERSEDED', 'WITHDRAWN']);
    expect(homeFor('ADMIN')).toBe('/admin'); expect(homeFor('TECHNICIAN')).toBe('/technician'); expect(homeFor('CUSTOMER')).toBe('/customer');
  });
});
