import { AppError } from './AppError.js';

export const BOOKING_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  INSPECTING: 'INSPECTING',
  INSPECTION_COMPLETED: 'INSPECTION_COMPLETED',
  QUOTATION_SENT: 'QUOTATION_SENT',
  QUOTATION_APPROVED: 'QUOTATION_APPROVED',
  QUOTATION_REJECTED: 'QUOTATION_REJECTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});
const S = BOOKING_STATUS;
const C = 'CUSTOMER', T = 'TECHNICIAN', A = 'ADMIN';

/** from -> to -> roles allowed to perform the transition (via the matching business action). */
export const TRANSITIONS = {
  [S.PENDING]: { [S.ASSIGNED]: [T, A], [S.CANCELLED]: [C, A] },
  [S.ASSIGNED]: { [S.INSPECTING]: [T], [S.INSPECTION_COMPLETED]: [T], [S.CANCELLED]: [C, A] },
  [S.INSPECTING]: { [S.INSPECTION_COMPLETED]: [T], [S.CANCELLED]: [C, A] },
  [S.INSPECTION_COMPLETED]: { [S.QUOTATION_SENT]: [T], [S.CANCELLED]: [C, A] },
  [S.QUOTATION_SENT]: { [S.QUOTATION_APPROVED]: [C], [S.QUOTATION_REJECTED]: [C], [S.CANCELLED]: [C, A] },
  [S.QUOTATION_REJECTED]: { [S.QUOTATION_SENT]: [T], [S.CANCELLED]: [C, A] },
  [S.QUOTATION_APPROVED]: { [S.IN_PROGRESS]: [T], [S.QUOTATION_SENT]: [T], [S.CANCELLED]: [C, A] },
  [S.IN_PROGRESS]: { [S.COMPLETED]: [T], [S.QUOTATION_SENT]: [T], [S.CANCELLED]: [A] },
  [S.COMPLETED]: {},
  [S.CANCELLED]: {},
};

/** Statuses a technician may set directly through POST /bookings/:id/status. Everything else uses a dedicated action. */
export const TECHNICIAN_MANUAL = {
  [S.ASSIGNED]: [S.INSPECTING],
  [S.QUOTATION_APPROVED]: [S.IN_PROGRESS],
};

export const TERMINAL = [S.COMPLETED, S.CANCELLED];

export function canTransition(from, to, role) {
  return Boolean(TRANSITIONS[from]?.[to]?.includes(role));
}

export function assertTransition(from, to, role) {
  if (!canTransition(from, to, role)) {
    throw AppError.conflict(`A ${role} cannot move a booking from ${from} to ${to}`, 'INVALID_STATUS_TRANSITION');
  }
}
