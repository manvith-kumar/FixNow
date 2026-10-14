// CONTRACT TEST: drives the frontend's own API modules against a LIVE FixNow backend with seed data.
// Run:  (backend running)  npm run test:api      Uses VITE_API_BASE_URL (default http://localhost:5000/api).
// It creates its own users/bookings, but needs the seed accounts (admin@fixnow.test etc.).
import { describe, it, expect, beforeAll } from 'vitest';
import { tokenStore } from './tokenStore.js';
import * as auth from './auth.js';
import * as catalogue from './catalogue.js';
import * as addresses from './addresses.js';
import * as bookings from './bookings.js';
import * as quotations from './quotations.js';
import * as payments from './payments.js';
import * as reviews from './reviews.js';
import * as notifications from './notifications.js';
import * as applications from './applications.js';
import * as technicians from './technicians.js';
import * as admin from './admin.js';
import * as users from './users.js';
import { getErrorCode } from '../utils/errors.js';

const as = (t) => tokenStore.set(t);
const fail = async (p) => { try { await p; } catch (e) { return e; } throw new Error('expected the request to fail'); };
const stamp = Date.now();
const S = {};
const tomorrow = () => new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
const pdf = () => new File([new Uint8Array(Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'))], 'id.pdf', { type: 'application/pdf' });

describe('frontend API modules against the real backend', () => {
  beforeAll(async () => {
    S.admin = (await auth.login({ email: 'admin@fixnow.test', password: 'Password@123' })).data.token;
    S.cust = (await auth.register({ email: `c${stamp}@t.dev`, password: 'Secret123', fullName: 'Contract Customer', role: 'CUSTOMER' })).data.token;
    S.tech = (await auth.register({ email: `t${stamp}@t.dev`, password: 'Secret123', fullName: 'Contract Tech', role: 'TECHNICIAN' })).data.token;
  });

  it('public catalogue and settings', async () => {
    tokenStore.clear();
    const cats = await catalogue.listCategories(); expect(cats.data.length).toBeGreaterThan(3);
    const svc = await catalogue.listServices({ q: 'Leak', page: 1, pageSize: 5 });
    expect(svc.meta.total).toBeGreaterThan(0); S.service = svc.data[0];
    expect(S.service.priceDisclaimer).toMatch(/Indicative/);
    expect((await catalogue.getService(S.service.id)).data.name).toBe(S.service.name);
    expect((await admin.publicSettings()).data.platform_name).toBe('FixNow');
    expect((await reviews.publicList({ pageSize: 3 })).data).toBeInstanceOf(Array);
  });

  it('auth: me, bad credentials code, change password returns a fresh token', async () => {
    as(S.cust); expect((await auth.me()).data.user.role).toBe('CUSTOMER');
    tokenStore.clear(); expect(getErrorCode(await fail(auth.login({ email: 'nobody@t.dev', password: 'Secret123' })))).toBe('INVALID_CREDENTIALS');
    as(S.cust); const ch = await auth.changePassword({ currentPassword: 'Secret123', newPassword: 'Secret456' }); S.cust = ch.data.token; as(S.cust);
    expect((await auth.me()).data.user.email).toBe(`c${stamp}@t.dev`);
    expect((await users.updateMe({ fullName: 'Contract Customer Two' })).data.fullName).toBe('Contract Customer Two');
  });

  it('technician application (multipart) and admin approval', async () => {
    as(S.tech);
    const app = await applications.submit({ fullName: 'Contract Tech', phone: '+911234567890', specialization: 'Plumbing', experienceYears: 4, serviceArea: 'Guntur', bio: 'hi', serviceIds: [S.service.id] }, [{ docType: 'ID_DOCUMENT', file: pdf() }]);
    expect(app.data.status).toBe('SUBMITTED'); expect(app.data.documents).toHaveLength(1); S.appId = app.data.id;
    expect((await applications.mine()).data.current.id).toBe(S.appId);
    expect(getErrorCode(await fail(bookings.available({})))).toBe('TECHNICIAN_NOT_APPROVED');
    as(S.admin);
    expect((await applications.adminList({ status: 'SUBMITTED', pageSize: 50 })).data.some((a) => a.id === S.appId)).toBe(true);
    const blob = await applications.downloadDocument(S.appId, app.data.documents[0].id); expect(blob).toBeTruthy();
    const d = await applications.decide(S.appId, 'APPROVE'); expect(d.data.status).toBe('APPROVED');
    as(S.tech); const me = await technicians.getMe(); expect(me.data.approvalStatus).toBe('APPROVED'); S.techProfileId = me.data.id;
    expect((await technicians.setAvailability([{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isAvailable: true }])).data).toHaveLength(1);
  });

  it('address, booking, accept, inspection, quotation, revision, decisions', async () => {
    as(S.cust);
    const addr = await addresses.create({ line1: '1 Contract Road', city: 'Guntur', latitude: 16.3, longitude: 80.4 }); S.addr = addr.data;
    expect(addr.data.isDefault).toBe(true);
    const b = await bookings.create({ serviceId: S.service.id, addressId: S.addr.id, problemDescription: 'Kitchen tap leaking badly', preferredDate: tomorrow(), preferredTime: '10:00' });
    S.b = b.data; expect(S.b.status).toBe('PENDING');
    as(S.tech); expect((await bookings.available({ pageSize: 50 })).data.some((x) => x.id === S.b.id)).toBe(true);
    expect((await bookings.accept(S.b.id)).data.status).toBe('ASSIGNED');
    expect((await bookings.setStatus(S.b.id, 'INSPECTING')).data.status).toBe('INSPECTING');
    expect((await bookings.saveInspection(S.b.id, { diagnosis: 'Worn washer', observedCondition: 'Drips steadily' })).data.status).toBe('INSPECTION_COMPLETED');
    const items = [{ itemType: 'LABOUR', description: 'Repair labour', quantity: '2', unitPrice: '300.00' }, { itemType: 'PART', description: 'Washer set', quantity: '1', unitPrice: '149.50' }];
    const q1 = await quotations.create({ bookingId: S.b.id, items, taxRate: '18', discountAmount: '10', notes: 'n' });
    expect(q1.data.totalAmount).toBe('872.61'); S.q1 = q1.data;
    as(S.cust);
    expect(getErrorCode(await fail(quotations.reject(S.q1.id, 'no')))).toBe('VALIDATION_ERROR');
    expect((await quotations.reject(S.q1.id, 'Too expensive')).data.status).toBe('REJECTED');
    as(S.tech);
    const q2 = await quotations.create({ bookingId: S.b.id, items: [{ ...items[0], unitPrice: '250.00' }, items[1]], revisionNotes: 'Lower rate' });
    expect(q2.data.versionNumber).toBe(2); S.q2 = q2.data;
    as(S.cust);
    const hist = (await quotations.forBooking(S.b.id)).data; expect(hist.map((h) => h.versionNumber)).toEqual([2, 1]); expect(hist[1].items).toHaveLength(2);
    expect((await bookings.quotationHistory(S.b.id)).data).toHaveLength(2);
    expect(getErrorCode(await fail(quotations.approve(S.q1.id)))).toBe('QUOTATION_STALE'); // v1 was replaced by v2
    expect((await quotations.approve(S.q2.id)).data.status).toBe('APPROVED');
  });

  it('work, completion, simulated payment (decline then success), duplicate protection, review', async () => {
    as(S.tech);
    expect((await bookings.setStatus(S.b.id, 'IN_PROGRESS')).data.status).toBe('IN_PROGRESS');
    expect((await bookings.complete(S.b.id, 'Replaced washer')).data.status).toBe('COMPLETED');
    as(S.cust);
    const declined = await payments.pay(S.b.id, 'DEMO_FAILING_CARD'); expect(declined.outcome).toBe('FAILED'); expect(declined.payment.isSimulated).toBe(true);
    const ok = await payments.pay(S.b.id, 'DEMO_UPI'); expect(ok.outcome).toBe('SUCCESS'); expect(ok.payment.amount).toBe('649.50'); // approved v2: 2 x 250.00 + 149.50, no tax or discount
    expect(getErrorCode(await fail(payments.pay(S.b.id, 'DEMO_CARD')))).toBe('ALREADY_PAID');
    const detail = (await bookings.getOne(S.b.id)).data; expect(detail.paymentStatus).toBe('PAID'); expect(detail.payment.transactionReference).toMatch(/^SIM-/);
    expect((await payments.list({ pageSize: 10 })).data.length).toBe(2);
    expect((await payments.getOne(ok.payment.id)).data.notice).toMatch(/no real money/i);
    const rev = await reviews.create({ bookingId: S.b.id, rating: 5, comment: 'Great' }); expect(rev.data.rating).toBe(5);
    expect(getErrorCode(await fail(reviews.create({ bookingId: S.b.id, rating: 4 })))).toBe('DUPLICATE_REVIEW');
    expect((await reviews.mine({})).data).toHaveLength(1);
    as(S.tech); expect(Number((await technicians.earnings()).data.totalAmount)).toBeGreaterThan(0);
  });

  it('notifications: list, unread count, mark one, mark all', async () => {
    as(S.cust);
    const l = await notifications.list({ page: 1, pageSize: 20 }); expect(l.meta.unread).toBeGreaterThan(0);
    expect((await notifications.markRead(l.data[0].id)).data.is_read).toBe(1);
    expect((await notifications.markAllRead()).data.updated).toBeGreaterThanOrEqual(0);
    expect((await notifications.list({ page: 1, pageSize: 1 })).meta.unread).toBe(0);
  });

  it('role isolation through the API modules', async () => {
    as(S.cust);
    expect((await fail(admin.dashboard())).response.status).toBe(403);
    expect((await fail(technicians.getMe())).response.status).toBe(403);
    as(S.tech); expect((await fail(addresses.list())).response.status).toBe(403);
    const other = (await auth.register({ email: `o${stamp}@t.dev`, password: 'Secret123', fullName: 'Other Customer', role: 'CUSTOMER' })).data.token;
    as(other); expect((await fail(bookings.getOne(S.b.id))).response.status).toBe(404);
    expect((await fail(quotations.getOne(S.q2.id))).response.status).toBe(404);
    tokenStore.clear(); expect((await fail(bookings.list({}))).response.status).toBe(401);
  });

  it('admin: dashboard, lists, catalogue management, reports, settings, moderation', async () => {
    as(S.admin);
    const dash = (await admin.dashboard()).data; expect(dash.completedBookings).toBeGreaterThan(0); expect(dash.isSimulated).toBe(true);
    expect((await users.list({ role: 'TECHNICIAN', pageSize: 5 })).data.length).toBeGreaterThan(0);
    expect((await technicians.adminList({ status: 'APPROVED' })).data.some((t) => t.id === S.techProfileId)).toBe(true);
    expect((await technicians.adminGet(S.techProfileId)).data.services.length).toBeGreaterThan(0);
    expect((await bookings.list({ status: 'COMPLETED', pageSize: 5 })).data.length).toBeGreaterThan(0);
    expect((await quotations.adminList({ currentOnly: 'true', pageSize: 5 })).data.length).toBeGreaterThan(0);
    expect((await payments.list({ pageSize: 5 })).data.length).toBeGreaterThan(0);
    const cat = await catalogue.createCategory({ name: `Contract ${stamp}`, isActive: true });
    const svc = await catalogue.createService({ categoryId: cat.data.id, name: `Contract Service ${stamp}`, indicativeStartingPrice: '99.00' });
    expect((await catalogue.updateService(svc.data.id, { isActive: false })).data.isActive).toBe(false);
    expect((await catalogue.listServices({ all: 'true', q: `Contract Service ${stamp}` })).data).toHaveLength(1);
    expect((await catalogue.listCategories({ all: 'true' })).data.some((c) => c.id === cat.data.id)).toBe(true);
    expect((await admin.reportTypes()).data).toContain('booking-volume');
    for (const t of ['booking-volume', 'service-demand', 'technician-workload', 'completed-cancelled', 'quotation-rates', 'payments-summary']) expect((await admin.report(t, {})).data.timezone).toBe('UTC');
    const csv = await admin.reportCsv('service-demand', {}); expect(csv).toBeTruthy();
    const st = await admin.updateSettings({ default_tax_rate: '12' }); expect(st.data.find((s) => s.key === 'default_tax_rate').value).toBe('12');
    expect((await admin.auditLogs({ pageSize: 5 })).data.length).toBeGreaterThan(0);
    const adminReviews = await reviews.adminList({ pageSize: 20 }); const mine = adminReviews.data.find((r) => r.bookingId === S.b.id);
    expect((await reviews.moderate(mine.id, 'HIDDEN', 'contract test')).data.status).toBe('HIDDEN');
    await reviews.moderate(mine.id, 'VISIBLE');
    expect((await users.setStatus((await auth.me()).data.user.id, 'DISABLED').catch((e) => e.response.status))).toBe(409);
    as(S.cust); expect((await auth.logout()).data.message).toBe('Logged out');
    expect((await fail(auth.me())).response.status).toBe(401);
  });
});
