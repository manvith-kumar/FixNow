import { pool, withTransaction, queryOne } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { calculateQuotation } from '../utils/money.js';
import { assertTransition, BOOKING_STATUS as S } from '../utils/bookingStateMachine.js';
import { paging, pageMeta } from '../utils/pagination.js';
import * as repo from '../repositories/quotations.repository.js';
import * as bookings from '../repositories/bookings.repository.js';
import { requireProfile } from './technicians.service.js';
import { notify, notifyAdmins } from './notification.service.js';

const CAN_QUOTE = [S.INSPECTION_COMPLETED, S.QUOTATION_SENT, S.QUOTATION_REJECTED, S.QUOTATION_APPROVED, S.IN_PROGRESS];
const todayUtc = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

async function defaultValidityDays(db) {
  const r = await queryOne(db, "SELECT setting_value v FROM system_settings WHERE setting_key='quotation_validity_days'");
  const n = Number(r?.v);
  return Number.isInteger(n) && n > 0 && n <= 90 ? n : 7;
}

/** Creates the FIRST quotation or a REVISION. Totals are always computed here, never taken from the client. */
export async function create(user, d) {
  let calc;
  try { calc = calculateQuotation({ items: d.items, discountAmount: d.discountAmount ?? '0', taxRate: d.taxRate ?? '0' }); }
  catch (e) { if (e instanceof RangeError) throw AppError.unprocessable(e.message, 'INVALID_QUOTATION'); throw e; }
  calc.items = calc.items.map((it, i) => ({ ...it, itemType: d.items[i].itemType }));

  const id = await withTransaction(async (conn) => {
    const profile = await requireProfile(conn, user.id, { eligible: true });
    const b = await bookings.lockById(conn, d.bookingId); // serialises concurrent revisions / decisions
    if (!b || b.technician_id !== profile.id) throw AppError.notFound('Booking not found');
    if (!CAN_QUOTE.includes(b.status)) throw AppError.conflict(`A quotation cannot be created while the booking is ${b.status}`, 'INVALID_BOOKING_STATE');
    if (b.payment_status === 'PAID') throw AppError.conflict('Booking is already paid', 'ALREADY_PAID');
    const inspection = await bookings.getInspection(conn, b.id);
    if (!inspection) throw AppError.conflict('Record the inspection before creating a quotation', 'INSPECTION_REQUIRED');

    const prev = await repo.currentForBooking(conn, b.id, true);
    const isRevision = !!prev;
    if ((b.status === S.QUOTATION_APPROVED || b.status === S.IN_PROGRESS) && !d.revisionNotes) throw AppError.unprocessable('Revision notes are required when changing an approved quotation', 'REVISION_NOTES_REQUIRED');
    const validUntil = d.validUntil ?? addDays(await defaultValidityDays(conn));
    if (validUntil < todayUtc()) throw AppError.unprocessable('Validity date cannot be in the past', 'INVALID_QUOTATION');

    if (prev) await repo.retireCurrent(conn, b.id);
    const version = (await repo.maxVersion(conn, b.id)) + 1;
    const quoteId = await repo.insert(conn, { bookingId: b.id, version, calc, notes: d.notes, revisionNotes: isRevision ? d.revisionNotes ?? null : null, validUntil, createdBy: user.id });

    if (b.status === S.QUOTATION_SENT) {
      await bookings.addHistory(conn, b.id, b.status, S.QUOTATION_SENT, user, `Quotation revised (v${version})`);
    } else {
      assertTransition(b.status, S.QUOTATION_SENT, 'TECHNICIAN');
      await bookings.setStatus(conn, b.id, S.QUOTATION_SENT);
      await bookings.addHistory(conn, b.id, b.status, S.QUOTATION_SENT, user, isRevision ? `Quotation revised (v${version})` : 'Quotation sent');
    }
    await notify(conn, { userId: b.customer_id, type: isRevision ? 'QUOTATION_REVISED' : 'QUOTATION_CREATED', title: isRevision ? 'Quotation revised' : 'New quotation',
      message: `A ${isRevision ? 'revised ' : ''}quotation (v${version}, total ${calc.totalAmount}) is awaiting your decision for booking ${b.reference}.`, resourceType: 'quotation', resourceId: quoteId });
    return quoteId;
  });
  return get(user, id);
}

async function decideInternal(user, quotationId, approve, reason) {
  await withTransaction(async (conn) => {
    const probe = await repo.getById(conn, quotationId);
    if (!probe) throw AppError.notFound('Quotation not found');
    const b = await bookings.lockById(conn, probe.booking_id); // booking lock first (same order as revisions) avoids deadlocks
    if (!b || b.customer_id !== user.id) throw AppError.notFound('Quotation not found');
    const q = await repo.getById(conn, quotationId, true);
    if (!q.is_current) throw AppError.conflict('This quotation has been replaced by a newer version', 'QUOTATION_STALE');
    if (q.status !== 'PENDING') throw AppError.conflict(`This quotation has already been ${q.status.toLowerCase()}`, 'QUOTATION_ALREADY_DECIDED');
    if (b.status !== S.QUOTATION_SENT) throw AppError.conflict('Booking is not awaiting a quotation decision', 'INVALID_BOOKING_STATE');
    if (approve && q.valid_until && q.valid_until < todayUtc()) throw AppError.conflict('This quotation has expired. Ask the technician for a new one.', 'QUOTATION_EXPIRED');
    const to = approve ? S.QUOTATION_APPROVED : S.QUOTATION_REJECTED;
    assertTransition(b.status, to, 'CUSTOMER');
    await repo.decide(conn, quotationId, approve ? 'APPROVED' : 'REJECTED', user.id, reason);
    await bookings.setStatus(conn, b.id, to);
    await bookings.addHistory(conn, b.id, b.status, to, user, approve ? `Quotation v${q.version_number} approved` : `Quotation v${q.version_number} rejected: ${reason}`);
    const t = b.technician_id ? await queryOne(conn, 'SELECT user_id FROM technician_profiles WHERE id = ?', [b.technician_id]) : null;
    if (t) await notify(conn, { userId: t.user_id, type: approve ? 'QUOTATION_APPROVED' : 'QUOTATION_REJECTED', title: approve ? 'Quotation approved' : 'Quotation rejected',
      message: approve ? `The customer approved quotation v${q.version_number} for ${b.reference}. You may start work.` : `The customer rejected quotation v${q.version_number} for ${b.reference}. Reason: ${reason}`, resourceType: 'quotation', resourceId: quotationId });
    await notify(conn, { userId: user.id, type: approve ? 'QUOTATION_APPROVED' : 'QUOTATION_REJECTED', title: approve ? 'You approved the quotation' : 'You rejected the quotation', message: `Booking ${b.reference}, quotation v${q.version_number}.`, resourceType: 'quotation', resourceId: quotationId });
    await notifyAdmins(conn, { type: approve ? 'QUOTATION_APPROVED' : 'QUOTATION_REJECTED', title: approve ? 'Quotation approved' : 'Quotation rejected', message: `${b.reference} quotation v${q.version_number}.`, resourceType: 'quotation', resourceId: quotationId });
  });
  return get(user, quotationId);
}
export const approve = (user, id) => decideInternal(user, id, true, null);
export const reject = (user, id, reason) => decideInternal(user, id, false, reason);

async function authorizeBooking(user, bookingId) {
  const b = await bookings.getById(pool, bookingId);
  if (!b) throw AppError.notFound('Booking not found');
  const allowed = user.role === 'ADMIN' || (user.role === 'CUSTOMER' && b.customer_id === user.id) || (user.role === 'TECHNICIAN' && b.technician_user_id === user.id);
  if (!allowed) throw AppError.notFound('Booking not found');
  return b;
}
export async function get(user, id) {
  const q = await repo.getById(pool, id);
  if (!q) throw AppError.notFound('Quotation not found');
  const b = await authorizeBooking(user, q.booking_id);
  // customers never see a quotation that was withdrawn before they could act on it? they may: it is part of history.
  return { ...(await repo.mapWithItems(pool, { ...q, booking_reference: b.reference, service_name: b.service_name })), };
}
/** All versions for a booking, newest first, with line items. */
export async function listForBooking(user, bookingId) {
  const b = await authorizeBooking(user, bookingId);
  const rows = await repo.listForBooking(pool, bookingId);
  const out = [];
  for (const q of rows) out.push(await repo.mapWithItems(pool, { ...q, booking_reference: b.reference, service_name: b.service_name }));
  return out;
}
export async function adminList(q) {
  const { rows, total } = await repo.adminList(pool, { ...q, ...paging(q) });
  return { rows: rows.map((r) => repo.mapQuotation(r)), meta: pageMeta(q, total) };
}
