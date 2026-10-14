import { pool, withTransaction } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { paging, pageMeta } from '../utils/pagination.js';
import * as repo from '../repositories/payments.repository.js';
import * as bookings from '../repositories/bookings.repository.js';
import * as quotes from '../repositories/quotations.repository.js';
import { activeGateway } from '../integrations/paymentGateway.js';
import { notify, notifyAdmins } from './notification.service.js';

const NOTICE = 'SIMULATED PAYMENT - no real money was charged.';
export const mapPayment = (p) => ({
  id: p.id, bookingId: p.booking_id, bookingReference: p.booking_reference, serviceName: p.service_name, quotationId: p.quotation_id,
  customerName: p.customer_name, technicianName: p.technician_name, amount: p.amount, currency: p.currency, method: p.method, status: p.status,
  transactionReference: p.transaction_reference, provider: p.provider, isSimulated: !!p.is_simulated, failureReason: p.failure_reason,
  createdAt: p.created_at, notice: p.is_simulated ? NOTICE : undefined,
});

export async function pay(user, { bookingId, method }) {
  const outcome = await withTransaction(async (conn) => {
    const b = await bookings.lockById(conn, bookingId); // serialises concurrent payment attempts for this booking
    if (!b || b.customer_id !== user.id) throw AppError.notFound('Booking not found');
    if (b.status !== 'COMPLETED') throw AppError.conflict('Payment is only available after the service is completed', 'NOT_PAYABLE');
    if (b.payment_status === 'PAID') throw AppError.conflict('This booking has already been paid', 'ALREADY_PAID');
    const q = await quotes.currentForBooking(conn, bookingId);
    if (!q || q.status !== 'APPROVED') throw AppError.conflict('No approved quotation found for this booking', 'QUOTATION_NOT_APPROVED');

    // The amount is ALWAYS the approved quotation total. The client cannot choose the amount or the result.
    const result = await activeGateway.charge({ amount: q.total_amount, currency: 'INR', method, bookingId });
    const id = await repo.insert(conn, { bookingId, quotationId: q.id, customerId: user.id, amount: q.total_amount, currency: 'INR', method,
      status: result.status, reference: result.reference, provider: result.provider, isSimulated: result.isSimulated, failureReason: result.failureReason });
    if (result.status === 'SUCCESS') {
      await repo.markBookingPaid(conn, bookingId); // unique (booking_id, success_key) is the final guard against duplicates
      await notify(conn, { userId: user.id, type: 'PAYMENT_COMPLETED', title: 'Payment received (simulated)', message: `Demo payment of ${q.total_amount} for ${b.reference} succeeded. No real money was charged.`, resourceType: 'payment', resourceId: id });
      const t = b.technician_id ? await conn.query('SELECT user_id FROM technician_profiles WHERE id = ?', [b.technician_id]).then(([r]) => r[0]) : null;
      if (t) await notify(conn, { userId: t.user_id, type: 'PAYMENT_COMPLETED', title: 'Customer paid (simulated)', message: `Booking ${b.reference} was paid via a simulated payment.`, resourceType: 'payment', resourceId: id });
      await notifyAdmins(conn, { type: 'PAYMENT_COMPLETED', title: 'Simulated payment', message: `${b.reference}: demo payment of ${q.total_amount}.`, resourceType: 'payment', resourceId: id });
    }
    return { id, status: result.status };
  }).catch((e) => { if (e.code === 'ER_DUP_ENTRY') throw AppError.conflict('This booking has already been paid', 'ALREADY_PAID'); throw e; });
  return { outcome: outcome.status, payment: await get(user, outcome.id) };
}

export async function get(user, id) {
  const p = await repo.getById(pool, id);
  const allowed = p && (user.role === 'ADMIN' || (user.role === 'CUSTOMER' && p.customer_id === user.id) || (user.role === 'TECHNICIAN' && p.technician_user_id === user.id));
  if (!allowed) throw AppError.notFound('Payment not found');
  return mapPayment(p);
}
export async function list(user, q) {
  const f = { ...q, ...paging(q) };
  if (user.role === 'CUSTOMER') f.customerId = user.id;
  if (user.role === 'TECHNICIAN') { f.technicianUserId = user.id; f.status = 'SUCCESS'; }
  const { rows, total } = await repo.list(pool, f);
  return { rows: rows.map(mapPayment), meta: pageMeta(q, total) };
}
