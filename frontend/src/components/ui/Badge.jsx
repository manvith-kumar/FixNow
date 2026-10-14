import { BOOKING_STATUS, QUOTE_STATUS, APPLICATION_STATUS, PAYMENT_STATUS } from '../../utils/status.js';
import { humanize } from '../../utils/format.js';

export const Badge = ({ tone = 'muted', children }) => <span className={`badge badge-${tone}`}>{children}</span>;
const pick = (map, key, short) => { const m = map[key]; return m ? <Badge tone={m.tone}>{short && m.short ? m.short : m.label}</Badge> : <Badge>{humanize(key)}</Badge>; };
export const BookingBadge = ({ status, short = true }) => pick(BOOKING_STATUS, status, short);
export const QuoteBadge = ({ status }) => pick(QUOTE_STATUS, status);
export const ApplicationBadge = ({ status }) => pick(APPLICATION_STATUS, status);
export const PaymentBadge = ({ status }) => pick(PAYMENT_STATUS, status);
export const ActiveBadge = ({ active }) => <Badge tone={active ? 'ok' : 'muted'}>{active ? 'Active' : 'Inactive'}</Badge>;
