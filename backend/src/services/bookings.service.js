import { pool, withTransaction, queryOne } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { bookingReference } from '../utils/ids.js';
import { paging, pageMeta } from '../utils/pagination.js';
import { assertTransition, TECHNICIAN_MANUAL, BOOKING_STATUS as S } from '../utils/bookingStateMachine.js';
import * as repo from '../repositories/bookings.repository.js';
import * as quoteRepo from '../repositories/quotations.repository.js';
import * as addrRepo from '../repositories/addresses.repository.js';
import * as catRepo from '../repositories/catalogue.repository.js';
import * as techRepo from '../repositories/technicians.repository.js';
import { requireProfile, isEligible } from './technicians.service.js';
import { notify, notifyAdmins } from './notification.service.js';
import { audit } from './audit.service.js';

const parseJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const todayUtc = () => new Date().toISOString().slice(0, 10);

/** viewer controls how much is revealed. Technicians browsing open jobs only see the neighbourhood, not the full address or customer contact. */
export function mapBooking(b, viewer = 'ADMIN', { limited = false } = {}) {
  const addr = parseJson(b.address_snapshot) ?? {};
  const out = {
    id: b.id, reference: b.reference, status: b.status, paymentStatus: b.payment_status,
    service: { id: b.service_id, name: b.service_name, categoryId: b.category_id, categoryName: b.category_name },
    problemDescription: b.problem_description, preferredDate: b.preferred_date, preferredTime: b.preferred_time.slice(0, 5),
    address: limited ? { city: addr.city, state: addr.state, postalCode: addr.postalCode } : addr,
    latitude: limited || b.latitude === null ? null : Number(b.latitude), longitude: limited || b.longitude === null ? null : Number(b.longitude),
    assignedAt: b.assigned_at, completedAt: b.completed_at, completionNotes: b.completion_notes,
    cancelledAt: b.cancelled_at, cancelReason: b.cancel_reason, createdAt: b.created_at, updatedAt: b.updated_at,
    currentQuotation: b.current_quote_status ? { status: b.current_quote_status, totalAmount: b.current_quote_total } : null,
    hasReview: !!b.review_id,
  };
  if (!limited) {
    if (viewer !== 'CUSTOMER') out.customer = { id: b.customer_id, fullName: b.customer_name, phone: b.customer_phone, email: viewer === 'ADMIN' ? b.customer_email : undefined };
    if (b.technician_id) out.technician = { id: b.technician_id, fullName: b.technician_name, phone: b.technician_phone, specialization: b.technician_specialization };
  }
  return out;
}

async function scopedBooking(db, user, id) {
  const b = await repo.getById(db, id);
  if (!b) throw AppError.notFound('Booking not found');
  if (user.role === 'ADMIN') return b;
  if (user.role === 'CUSTOMER') { if (b.customer_id !== user.id) throw AppError.notFound('Booking not found'); return b; }
  if (user.role === 'TECHNICIAN') { if (b.technician_user_id !== user.id) throw AppError.notFound('Booking not found'); return b; }
  throw AppError.forbidden();
}

export async function create(user, d) {
  const today = todayUtc();
  const max = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  if (d.preferredDate < today) throw AppError.badRequest('Preferred date cannot be in the past', undefined);
  if (d.preferredDate > max) throw AppError.badRequest('Preferred date must be within the next 90 days');
  const id = await withTransaction(async (conn) => {
    const svc = await catRepo.getService(conn, d.serviceId);
    if (!svc || !svc.is_active || !svc.category_active) throw AppError.badRequest('The selected service is not available');
    const addr = await addrRepo.findOwned(conn, d.addressId, user.id); // ownership enforced here
    if (!addr) throw AppError.badRequest('Address not found');
    const snapshot = { label: addr.label, line1: addr.line1, line2: addr.line2, city: addr.city, state: addr.state, postalCode: addr.postal_code, country: addr.country };
    const lat = d.latitude ?? (addr.latitude === null ? null : Number(addr.latitude));
    const lng = d.longitude ?? (addr.longitude === null ? null : Number(addr.longitude));
    let bookingId;
    for (let attempt = 0; attempt < 5 && !bookingId; attempt++) {
      try {
        bookingId = await repo.insert(conn, { reference: bookingReference(), customerId: user.id, serviceId: d.serviceId, addressId: addr.id, addressSnapshot: snapshot,
          problemDescription: d.problemDescription, preferredDate: d.preferredDate, preferredTime: d.preferredTime, latitude: lat, longitude: lng });
      } catch (e) { if (e.code !== 'ER_DUP_ENTRY' || attempt === 4) throw e; }
    }
    await repo.addHistory(conn, bookingId, null, S.PENDING, user, 'Booking created');
    const ref = (await repo.lockById(conn, bookingId)).reference;
    await notify(conn, { userId: user.id, type: 'BOOKING_CREATED', title: 'Booking received', message: `Your booking ${ref} for ${svc.name} was created. A technician will accept it soon.`, resourceType: 'booking', resourceId: bookingId });
    await notifyAdmins(conn, { type: 'BOOKING_CREATED', title: 'New booking', message: `${user.full_name} booked ${svc.name} (${ref}).`, resourceType: 'booking', resourceId: bookingId });
    for (const uid of await repo.eligibleTechnicianUserIds(conn, d.serviceId))
      await notify(conn, { userId: uid, type: 'NEW_JOB_AVAILABLE', title: 'New job available', message: `A new ${svc.name} job is available in ${snapshot.city}.`, resourceType: 'booking', resourceId: bookingId });
    return bookingId;
  });
  return get(user, id);
}

export async function list(user, q) {
  const filters = { ...q, ...paging(q) };
  if (user.role === 'CUSTOMER') filters.customerId = user.id;
  else if (user.role === 'TECHNICIAN') { const p = await requireProfile(pool, user.id); filters.technicianId = p.id; }
  const { rows, total } = await repo.list(pool, filters);
  return { rows: rows.map((b) => mapBooking(b, user.role)), meta: pageMeta(q, total) };
}

export async function availableJobs(user, q) {
  const p = await requireProfile(pool, user.id, { eligible: true });
  const { rows, total } = await repo.available(pool, p.id, paging(q));
  return { rows: rows.map((b) => mapBooking(b, 'TECHNICIAN', { limited: true })), meta: pageMeta(q, total) };
}

export async function get(user, id) {
  const b = await scopedBooking(pool, user, id);
  const out = mapBooking(b, user.role);
  out.history = (await repo.history(pool, id)).map((h) => ({ id: h.id, fromStatus: h.from_status, toStatus: h.to_status, actorRole: h.actor_role, actorName: h.actor_name, note: h.note, createdAt: h.created_at }));
  const insp = await repo.getInspection(pool, id);
  out.inspection = insp ? { diagnosis: insp.diagnosis, observedCondition: insp.observed_condition, labourNotes: insp.labour_notes, requiredParts: insp.required_parts, additionalWork: insp.additional_work, notes: insp.notes, updatedAt: insp.updated_at } : null;
  const q = await quoteRepo.currentForBooking(pool, id);
  out.currentQuotation = q ? await quoteRepo.mapWithItems(pool, q) : null;
  out.payment = await queryOne(pool, "SELECT id, amount, currency, method, transaction_reference AS transactionReference, created_at AS paidAt, is_simulated AS isSimulated FROM payments WHERE booking_id = ? AND status = 'SUCCESS'", [id]);
  return out;
}

export async function accept(user, bookingId, ip) {
  await withTransaction(async (conn) => {
    const profile = await requireProfile(conn, user.id, { eligible: true }); // approved + active enforced server-side
    const b = await repo.lockById(conn, bookingId);
    if (!b) throw AppError.notFound('Booking not found');
    if (!(await repo.technicianOffers(conn, profile.id, b.service_id))) throw AppError.forbidden('You do not offer this service');
    if (b.status !== S.PENDING || b.technician_id) throw AppError.conflict('This job has already been accepted by another technician', 'JOB_ALREADY_TAKEN');
    assertTransition(b.status, S.ASSIGNED, 'TECHNICIAN');
    const res = await repo.claim(conn, bookingId, profile.id); // conditional update: exactly one winner
    if (res.affectedRows !== 1) throw AppError.conflict('This job has already been accepted by another technician', 'JOB_ALREADY_TAKEN');
    await repo.addHistory(conn, bookingId, S.PENDING, S.ASSIGNED, user, `Accepted by ${profile.full_name}`);
    await notify(conn, { userId: b.customer_id, type: 'TECHNICIAN_ASSIGNED', title: 'Technician assigned', message: `${profile.full_name} will handle your booking ${b.reference}.`, resourceType: 'booking', resourceId: bookingId });
    await notifyAdmins(conn, { type: 'TECHNICIAN_ASSIGNED', title: 'Job accepted', message: `${profile.full_name} accepted ${b.reference}.`, resourceType: 'booking', resourceId: bookingId });
  });
  return get(user, bookingId);
}

export async function adminAssign(actor, bookingId, technicianId, ip) {
  await withTransaction(async (conn) => {
    const b = await repo.lockById(conn, bookingId);
    if (!b) throw AppError.notFound('Booking not found');
    const p = await techRepo.findProfileById(conn, technicianId);
    if (!p) throw AppError.badRequest('Technician not found');
    if (!isEligible(p)) throw AppError.conflict('Technician is not approved and active', 'TECHNICIAN_NOT_APPROVED');
    if (!(await repo.technicianOffers(conn, p.id, b.service_id))) throw AppError.conflict('Technician does not offer this service');
    if (b.status !== S.PENDING || b.technician_id) throw AppError.conflict('This job has already been assigned', 'JOB_ALREADY_TAKEN');
    assertTransition(b.status, S.ASSIGNED, 'ADMIN');
    const res = await repo.claim(conn, bookingId, p.id);
    if (res.affectedRows !== 1) throw AppError.conflict('This job has already been assigned', 'JOB_ALREADY_TAKEN');
    await repo.addHistory(conn, bookingId, S.PENDING, S.ASSIGNED, actor, `Assigned to ${p.full_name} by administrator`);
    await notify(conn, { userId: b.customer_id, type: 'TECHNICIAN_ASSIGNED', title: 'Technician assigned', message: `${p.full_name} will handle your booking ${b.reference}.`, resourceType: 'booking', resourceId: bookingId });
    await notify(conn, { userId: p.user_id, type: 'JOB_ASSIGNED', title: 'Job assigned to you', message: `You were assigned booking ${b.reference}.`, resourceType: 'booking', resourceId: bookingId });
    await audit(conn, actor, 'BOOKING_ASSIGNED', 'booking', bookingId, { technicianId }, ip);
  });
  return get(actor, bookingId);
}

/** Technician-controlled manual transitions only (other transitions have dedicated actions). */
export async function technicianStatus(user, bookingId, toStatus) {
  await withTransaction(async (conn) => {
    const profile = await requireProfile(conn, user.id, { eligible: true });
    const b = await repo.lockById(conn, bookingId);
    if (!b || b.technician_id !== profile.id) throw AppError.notFound('Booking not found');
    if (!TECHNICIAN_MANUAL[b.status]?.includes(toStatus)) throw AppError.conflict(`Status cannot be changed from ${b.status} to ${toStatus} this way`, 'INVALID_STATUS_TRANSITION');
    assertTransition(b.status, toStatus, 'TECHNICIAN');
    if (toStatus === S.IN_PROGRESS) {
      const q = await quoteRepo.currentForBooking(conn, bookingId);
      if (!q || q.status !== 'APPROVED') throw AppError.conflict('Work cannot start until the customer approves the current quotation', 'QUOTATION_NOT_APPROVED');
    }
    await repo.setStatus(conn, bookingId, toStatus);
    await repo.addHistory(conn, bookingId, b.status, toStatus, user);
    await notify(conn, { userId: b.customer_id, type: 'BOOKING_STATUS', title: 'Booking update', message: `Booking ${b.reference} is now ${toStatus.replaceAll('_', ' ').toLowerCase()}.`, resourceType: 'booking', resourceId: bookingId });
  });
  return get(user, bookingId);
}

export async function cancel(user, bookingId, reason, ip) {
  await withTransaction(async (conn) => {
    const b = await repo.lockById(conn, bookingId);
    if (!b || (user.role === 'CUSTOMER' && b.customer_id !== user.id)) throw AppError.notFound('Booking not found');
    assertTransition(b.status, S.CANCELLED, user.role);
    await repo.cancel(conn, bookingId, user.id, reason);
    await quoteRepo.withdrawPending(conn, bookingId);
    await repo.addHistory(conn, bookingId, b.status, S.CANCELLED, user, reason);
    if (user.role !== 'CUSTOMER') await notify(conn, { userId: b.customer_id, type: 'BOOKING_CANCELLED', title: 'Booking cancelled', message: `Booking ${b.reference} was cancelled.${reason ? ' Reason: ' + reason : ''}`, resourceType: 'booking', resourceId: bookingId });
    if (b.technician_id) {
      const t = await techRepo.findProfileById(conn, b.technician_id);
      await notify(conn, { userId: t.user_id, type: 'BOOKING_CANCELLED', title: 'Booking cancelled', message: `Booking ${b.reference} was cancelled.`, resourceType: 'booking', resourceId: bookingId });
    }
    if (user.role === 'ADMIN') await audit(conn, user, 'BOOKING_CANCELLED', 'booking', bookingId, { reason }, ip);
  });
  return get(user, bookingId);
}

export async function saveInspection(user, bookingId, d) {
  await withTransaction(async (conn) => {
    const profile = await requireProfile(conn, user.id, { eligible: true });
    const b = await repo.lockById(conn, bookingId);
    if (!b || b.technician_id !== profile.id) throw AppError.notFound('Booking not found');
    if (![S.ASSIGNED, S.INSPECTING, S.INSPECTION_COMPLETED].includes(b.status)) throw AppError.conflict('Inspection can only be recorded before a quotation is sent', 'INVALID_BOOKING_STATE');
    await repo.upsertInspection(conn, bookingId, profile.id, d);
    if (b.status !== S.INSPECTION_COMPLETED) {
      assertTransition(b.status, S.INSPECTION_COMPLETED, 'TECHNICIAN');
      await repo.setStatus(conn, bookingId, S.INSPECTION_COMPLETED);
      await repo.addHistory(conn, bookingId, b.status, S.INSPECTION_COMPLETED, user, 'Inspection recorded');
      await notify(conn, { userId: b.customer_id, type: 'INSPECTION_COMPLETED', title: 'Inspection completed', message: `Inspection of booking ${b.reference} is complete. A quotation will follow.`, resourceType: 'booking', resourceId: bookingId });
    }
  });
  return get(user, bookingId);
}

export async function completeJob(user, bookingId, notes) {
  await withTransaction(async (conn) => {
    const profile = await requireProfile(conn, user.id, { eligible: true });
    const b = await repo.lockById(conn, bookingId);
    if (!b || b.technician_id !== profile.id) throw AppError.notFound('Booking not found');
    assertTransition(b.status, S.COMPLETED, 'TECHNICIAN');
    const q = await quoteRepo.currentForBooking(conn, bookingId);
    if (!q || q.status !== 'APPROVED') throw AppError.conflict('Work can only be completed under an approved quotation', 'QUOTATION_NOT_APPROVED');
    await repo.complete(conn, bookingId, notes);
    await repo.addHistory(conn, bookingId, b.status, S.COMPLETED, user, 'Service completed');
    await notify(conn, { userId: b.customer_id, type: 'SERVICE_COMPLETED', title: 'Service completed', message: `Booking ${b.reference} is complete. You can now pay (simulated) and leave a review.`, resourceType: 'booking', resourceId: bookingId });
    await notifyAdmins(conn, { type: 'SERVICE_COMPLETED', title: 'Service completed', message: `Booking ${b.reference} was completed.`, resourceType: 'booking', resourceId: bookingId });
  });
  return get(user, bookingId);
}
