// Status vocabulary mirrors docs/DECISIONS.md and the backend enums exactly.
export const BOOKING_STATUS = {
  PENDING: { label: 'Waiting for a technician', short: 'Pending', tone: 'warn' },
  ASSIGNED: { label: 'Technician assigned', short: 'Assigned', tone: 'info' },
  INSPECTING: { label: 'Inspection in progress', short: 'Inspecting', tone: 'info' },
  INSPECTION_COMPLETED: { label: 'Inspection done, quote coming', short: 'Inspected', tone: 'info' },
  QUOTATION_SENT: { label: 'Quotation awaiting approval', short: 'Quote sent', tone: 'warn' },
  QUOTATION_APPROVED: { label: 'Quotation approved', short: 'Approved', tone: 'ok' },
  QUOTATION_REJECTED: { label: 'Quotation rejected', short: 'Rejected', tone: 'bad' },
  IN_PROGRESS: { label: 'Work in progress', short: 'In progress', tone: 'info' },
  COMPLETED: { label: 'Completed', short: 'Completed', tone: 'ok' },
  CANCELLED: { label: 'Cancelled', short: 'Cancelled', tone: 'muted' },
};
export const BOOKING_STATUS_LIST = Object.keys(BOOKING_STATUS);
export const bookingLabel = (s, short = false) => (BOOKING_STATUS[s] ? (short ? BOOKING_STATUS[s].short : BOOKING_STATUS[s].label) : s);

export const QUOTE_STATUS = {
  PENDING: { label: 'Awaiting decision', tone: 'warn' },
  APPROVED: { label: 'Approved', tone: 'ok' },
  REJECTED: { label: 'Rejected', tone: 'bad' },
  SUPERSEDED: { label: 'Replaced by newer version', tone: 'muted' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'muted' },
};
export const APPLICATION_STATUS = {
  NOT_APPLIED: { label: 'Not applied', tone: 'muted' },
  PENDING: { label: 'Under review', tone: 'warn' },
  SUBMITTED: { label: 'Under review', tone: 'warn' },
  NEEDS_INFO: { label: 'More information needed', tone: 'bad' },
  APPROVED: { label: 'Approved', tone: 'ok' },
  REJECTED: { label: 'Not approved', tone: 'bad' },
};
export const PAYMENT_STATUS = { SUCCESS: { label: 'Paid (simulated)', tone: 'ok' }, FAILED: { label: 'Declined (simulated)', tone: 'bad' } };
export const ITEM_TYPES = [
  { value: 'LABOUR', label: 'Labour' }, { value: 'PART', label: 'Part' }, { value: 'MATERIAL', label: 'Material' }, { value: 'ADDITIONAL', label: 'Additional work' },
];
export const itemTypeLabel = (v) => ITEM_TYPES.find((t) => t.value === v)?.label ?? v;
export const DEMO_METHODS = [
  { value: 'DEMO_CARD', label: 'Demo card', hint: 'Always succeeds. No card details are collected.' },
  { value: 'DEMO_UPI', label: 'Demo UPI', hint: 'Always succeeds. No UPI ID is collected.' },
  { value: 'DEMO_WALLET', label: 'Demo wallet', hint: 'Always succeeds.' },
  { value: 'DEMO_FAILING_CARD', label: 'Demo card that fails', hint: 'Always declines, so you can see the failure path.' },
];
export const methodLabel = (v) => DEMO_METHODS.find((m) => m.value === v)?.label ?? v;

export const ROLE_HOME = { CUSTOMER: '/customer', TECHNICIAN: '/technician', ADMIN: '/admin' };
export const homeFor = (role) => ROLE_HOME[role] ?? '/';
export const ROLE_LABEL = { CUSTOMER: 'Customer', TECHNICIAN: 'Technician', ADMIN: 'Administrator' };

/** Statuses in which a customer may still cancel / a booking is finished. Mirrors the backend state machine. */
export const CUSTOMER_CANCELLABLE = ['PENDING', 'ASSIGNED', 'INSPECTING', 'INSPECTION_COMPLETED', 'QUOTATION_SENT', 'QUOTATION_REJECTED', 'QUOTATION_APPROVED'];
export const ADMIN_CANCELLABLE = [...CUSTOMER_CANCELLABLE, 'IN_PROGRESS'];
export const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED'];
