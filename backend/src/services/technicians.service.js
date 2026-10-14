import { pool, withTransaction } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { paging, pageMeta } from '../utils/pagination.js';
import * as repo from '../repositories/technicians.repository.js';
import { audit } from './audit.service.js';

export const mapProfile = (p) => ({
  id: p.id, userId: p.user_id, fullName: p.full_name, email: p.email, phone: p.phone, specialization: p.specialization,
  experienceYears: p.experience_years, serviceArea: p.service_area, bio: p.bio, approvalStatus: p.approval_status,
  isActive: !!p.is_active, approvedAt: p.approved_at, userStatus: p.user_status,
  ...(p.open_jobs !== undefined ? { openJobs: p.open_jobs, completedJobs: p.completed_jobs, avgRating: p.avg_rating } : {}),
});
const mapSlot = (s) => ({ id: s.id, dayOfWeek: s.day_of_week, startTime: s.start_time.slice(0, 5), endTime: s.end_time.slice(0, 5), isAvailable: !!s.is_available });

/** Single source of truth for "may this technician accept jobs / do technician work?" */
export function isEligible(p) { return p && p.approval_status === 'APPROVED' && p.is_active === 1 && p.user_status === 'ACTIVE'; }
export async function requireProfile(db, userId, { eligible = false, forUpdate = false } = {}) {
  const p = await repo.findProfileByUser(db, userId, forUpdate);
  if (!p) throw AppError.forbidden('Technician profile not found');
  if (eligible && !isEligible(p)) throw new AppError(403, 'TECHNICIAN_NOT_APPROVED', 'Your technician account is not approved and active');
  return p;
}

export async function getMe(userId) {
  const p = await requireProfile(pool, userId);
  return { ...mapProfile(p), services: await repo.listServices(pool, p.id), availability: (await repo.listAvailability(pool, p.id)).map(mapSlot) };
}
export async function updateMe(userId, d) {
  await withTransaction(async (conn) => {
    const p = await requireProfile(conn, userId, { forUpdate: true });
    await repo.updateProfile(conn, p.id, d);
    if (d.serviceIds) {
      if (p.approval_status !== 'APPROVED') throw AppError.forbidden('Services can be changed after your application is approved');
      const valid = await repo.activeServiceIds(conn, d.serviceIds);
      if (valid.length !== new Set(d.serviceIds).size) throw AppError.badRequest('One or more selected services are invalid or inactive');
      await repo.replaceServices(conn, p.id, valid);
    }
  });
  return getMe(userId);
}
export async function getAvailability(userId) {
  const p = await requireProfile(pool, userId);
  return (await repo.listAvailability(pool, p.id)).map(mapSlot);
}
export async function setAvailability(userId, slots) {
  const sorted = [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].dayOfWeek === sorted[i - 1].dayOfWeek && sorted[i].startTime < sorted[i - 1].endTime) throw AppError.badRequest('Availability slots on the same day must not overlap');
  }
  await withTransaction(async (conn) => {
    const p = await requireProfile(conn, userId, { forUpdate: true });
    await repo.replaceAvailability(conn, p.id, slots);
  });
  return getAvailability(userId);
}
export async function earnings(userId) {
  const p = await requireProfile(pool, userId);
  const e = await repo.earnings(pool, p.id);
  return {
    isSimulated: true, notice: 'Amounts come from SIMULATED demo payments. No real money was transferred.',
    totalAmount: e.summary.total_amount, paymentCount: e.summary.payment_count,
    payments: e.rows.map((r) => ({ id: r.id, amount: r.amount, currency: r.currency, transactionReference: r.transaction_reference, paidAt: r.created_at, bookingId: r.booking_id, bookingReference: r.booking_reference, serviceName: r.service_name })),
  };
}
export async function adminList(q) {
  const { rows, total } = await repo.adminList(pool, { ...q, ...paging(q) });
  return { rows: rows.map(mapProfile), meta: pageMeta(q, total) };
}
export async function adminGet(id) {
  const p = await repo.findProfileById(pool, id);
  if (!p) throw AppError.notFound('Technician not found');
  return { ...mapProfile(p), services: await repo.listServices(pool, p.id), availability: (await repo.listAvailability(pool, p.id)).map(mapSlot) };
}
export async function adminSetActive(actor, id, active, ip) {
  const p = await repo.findProfileById(pool, id);
  if (!p) throw AppError.notFound('Technician not found');
  await repo.setActive(pool, id, active);
  await audit(pool, actor, active ? 'TECHNICIAN_ACTIVATED' : 'TECHNICIAN_DEACTIVATED', 'technician', id, null, ip);
  return adminGet(id);
}
