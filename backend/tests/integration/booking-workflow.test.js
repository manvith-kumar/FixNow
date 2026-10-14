import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, login, bearer, register, approvedTechnician, futureDate } from '../helpers.js';

let ctx, admin, customer, tech1, tech2, serviceId, addressId;
const items = [
  { itemType: 'LABOUR', description: 'Inspection and repair labour', quantity: '2', unitPrice: '300.00' },
  { itemType: 'PART', description: 'Replacement washer set', quantity: '1', unitPrice: '149.50' },
];
before(async () => {
  ctx = await bootApp();
  admin = await login(ctx.api, 'admin@fixnow.test');
  customer = await login(ctx.api, 'customer@fixnow.test');
  serviceId = (await ctx.api.get('/api/services?q=Leak')).body.data[0].id;
  addressId = (await ctx.api.get('/api/addresses').set(bearer(customer))).body.data[0].id;
  tech1 = await approvedTechnician(ctx.api, admin, [serviceId]);
  tech2 = await approvedTechnician(ctx.api, admin, [serviceId]);
});
after(async () => { await ctx.close(); });

const book = (token = customer, over = {}) => ctx.api.post('/api/bookings').set(bearer(token)).send({
  serviceId, addressId, problemDescription: 'Kitchen tap is leaking badly', preferredDate: futureDate(), preferredTime: '10:30', ...over });
const post = (path, token, body = {}) => ctx.api.post(path).set(bearer(token)).send(body);
const inspect = (id, token) => post(`/api/bookings/${id}/inspection`, token, { diagnosis: 'Worn washer', observedCondition: 'Steady drip from spout', requiredParts: 'Washer set' });
const quote = (bookingId, token, over = {}) => post('/api/quotations', token, { bookingId, items, taxRate: '18', discountAmount: '10', notes: 'Valid for a week', ...over });

async function jobAtQuotation() {
  const b = (await book()).body.data;
  assert.equal((await post(`/api/bookings/${b.id}/accept`, tech1.token)).status, 200);
  assert.equal((await inspect(b.id, tech1.token)).status, 200);
  const q = await quote(b.id, tech1.token);
  assert.equal(q.status, 201, JSON.stringify(q.body));
  return { b, q: q.body.data };
}

test('booking creation: validation, ownership, reference, history and notifications', async () => {
  const r = await book();
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.data.reference, /^FN-\d{8}-[A-Z2-9]{6}$/);
  assert.equal(r.body.data.status, 'PENDING');
  assert.equal(r.body.data.history[0].toStatus, 'PENDING');
  assert.equal(r.body.data.address.city, 'Guntur');
  assert.equal((await book(customer, { preferredDate: '2020-01-01' })).status, 400, 'past date');
  assert.equal((await book(customer, { serviceId: 999999 })).status, 400, 'unknown service');
  assert.equal((await book(customer, { problemDescription: 'short' })).status, 400);
  assert.equal((await book(customer, { latitude: 12.3 })).status, 400, 'lat without lng');
  assert.equal((await book(customer, { latitude: 16.3, longitude: 80.4 })).status, 201, 'optional coordinates accepted');
  assert.equal((await book(customer, { status: 'COMPLETED' })).status, 400, 'client cannot set status');
  const n = await ctx.api.get('/api/notifications').set(bearer(customer));
  assert.ok(n.body.data.some((x) => x.type === 'BOOKING_CREATED'));
  const a = await ctx.api.get('/api/notifications').set(bearer(admin));
  assert.ok(a.body.data.some((x) => x.type === 'BOOKING_CREATED'));
});

test('a customer cannot book with someone else\'s address or view someone else\'s booking', async () => {
  const other = await register(ctx.api, 'CUSTOMER');
  const addr = await ctx.api.post('/api/addresses').set(bearer(other.token)).send({ line1: '9 Other Road', city: 'Vijayawada' });
  assert.equal(addr.status, 201); assert.equal(addr.body.data.isDefault, true);
  assert.equal((await book(customer, { addressId: addr.body.data.id })).status, 400, 'foreign address rejected');
  const mine = (await book()).body.data;
  assert.equal((await ctx.api.get(`/api/bookings/${mine.id}`).set(bearer(other.token))).status, 404);
  assert.equal((await ctx.api.post(`/api/bookings/${mine.id}/cancel`).set(bearer(other.token)).send({})).status, 404);
  assert.equal((await ctx.api.get(`/api/bookings/${mine.id}/quotations`).set(bearer(other.token))).status, 404);
  assert.equal((await ctx.api.get('/api/bookings').set(bearer(other.token))).body.data.length, 0);
  assert.equal((await ctx.api.patch(`/api/addresses/${addr.body.data.id}`).set(bearer(customer)).send({ city: 'Xyz' })).status, 404, 'cannot edit another user\'s address');
  assert.equal((await ctx.api.delete(`/api/addresses/${addr.body.data.id}`).set(bearer(customer))).status, 404);
  assert.equal((await ctx.api.get(`/api/bookings/${mine.id}`).set(bearer(tech1.token))).status, 404, 'unassigned technician cannot read it');
});

test('CONCURRENCY: when two technicians accept the same job at once, exactly one wins', async () => {
  const b = (await book()).body.data;
  const results = await Promise.all([post(`/api/bookings/${b.id}/accept`, tech1.token), post(`/api/bookings/${b.id}/accept`, tech2.token)]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [200, 409], JSON.stringify(results.map((r) => r.body)));
  const loser = results.find((r) => r.status === 409);
  assert.equal(loser.body.error.code, 'JOB_ALREADY_TAKEN');
  const [[row]] = await ctx.pool.query('SELECT COUNT(*) c FROM booking_status_history WHERE booking_id = ? AND to_status = ?', [b.id, 'ASSIGNED']);
  assert.equal(row.c, 1, 'exactly one ASSIGNED history row');
});

test('many simultaneous accept attempts still produce a single assignment', async () => {
  const b = (await book()).body.data;
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => post(`/api/bookings/${b.id}/accept`, i % 2 ? tech1.token : tech2.token)));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.ok(results.filter((r) => r.status !== 200).every((r) => r.status === 409));
});

test('inspection persists, is technician-only, and requires assignment', async () => {
  const b = (await book()).body.data;
  assert.equal((await inspect(b.id, tech1.token)).status, 404, 'unassigned technician cannot inspect');
  await post(`/api/bookings/${b.id}/accept`, tech1.token);
  assert.equal((await inspect(b.id, tech2.token)).status, 404, 'other technician cannot inspect');
  assert.equal((await inspect(b.id, customer)).status, 403);
  assert.equal((await post(`/api/bookings/${b.id}/status`, tech1.token, { status: 'INSPECTING' })).status, 200);
  const r = await inspect(b.id, tech1.token);
  assert.equal(r.status, 200); assert.equal(r.body.data.status, 'INSPECTION_COMPLETED');
  assert.equal(r.body.data.inspection.diagnosis, 'Worn washer');
  const [[row]] = await ctx.pool.query('SELECT diagnosis FROM inspections WHERE booking_id = ?', [b.id]);
  assert.equal(row.diagnosis, 'Worn washer');
});

test('quotation: server-calculated totals, client totals rejected, validation rules', async () => {
  const b = (await book()).body.data;
  await post(`/api/bookings/${b.id}/accept`, tech1.token);
  assert.equal((await quote(b.id, tech1.token)).status, 409, 'inspection required first');
  await inspect(b.id, tech1.token);
  assert.equal((await quote(b.id, tech1.token, { totalAmount: '1.00' })).status, 400, 'client-supplied total rejected');
  assert.equal((await quote(b.id, tech1.token, { taxRate: '45' })).status, 422);
  assert.equal((await quote(b.id, tech1.token, { discountAmount: '99999' })).status, 422);
  assert.equal((await quote(b.id, tech1.token, { items: [{ ...items[0], unitPrice: '-5' }] })).status, 422);
  assert.equal((await quote(b.id, tech1.token, { items: [{ ...items[0], quantity: '0' }] })).status, 422);
  assert.equal((await quote(b.id, tech1.token, { items: [] })).status, 400);
  assert.equal((await quote(b.id, customer)).status, 403);
  assert.equal((await quote(b.id, tech2.token)).status, 404, 'unassigned technician cannot quote');
  const q = await quote(b.id, tech1.token);
  assert.equal(q.status, 201);
  // subtotal 749.50, discount 10 -> 739.50, tax 18% = 133.11, total 872.61
  assert.equal(q.body.data.subtotal, '749.50'); assert.equal(q.body.data.taxAmount, '133.11'); assert.equal(q.body.data.totalAmount, '872.61');
  assert.equal(q.body.data.versionNumber, 1); assert.equal(q.body.data.items.length, 2);
  const bk = (await ctx.api.get(`/api/bookings/${b.id}`).set(bearer(customer))).body.data;
  assert.equal(bk.status, 'QUOTATION_SENT');
  assert.equal(bk.currentQuotation.totalAmount, '872.61');
});

test('quotation versioning, stale approval protection, reject then revise then approve', async () => {
  const { b, q: v1 } = await jobAtQuotation();
  // reject needs a reason
  assert.equal((await post(`/api/quotations/${v1.id}/reject`, customer, {})).status, 400);
  const rej = await post(`/api/quotations/${v1.id}/reject`, customer, { reason: 'Parts price too high' });
  assert.equal(rej.status, 200); assert.equal(rej.body.data.status, 'REJECTED');
  assert.equal((await ctx.api.get(`/api/bookings/${b.id}`).set(bearer(customer))).body.data.status, 'QUOTATION_REJECTED');
  assert.equal((await post(`/api/quotations/${v1.id}/approve`, customer)).status, 409, 'rejected quotation cannot be approved later');
  assert.equal((await post(`/api/bookings/${b.id}/status`, tech1.token, { status: 'IN_PROGRESS' })).status, 409, 'no work after rejection');

  // revision creates v2, preserves v1 and its items
  const v2 = await quote(b.id, tech1.token, { items: [{ ...items[0], unitPrice: '250.00' }, items[1]], revisionNotes: 'Reduced labour rate' });
  assert.equal(v2.status, 201); assert.equal(v2.body.data.versionNumber, 2);
  const hist = (await ctx.api.get(`/api/bookings/${b.id}/quotations`).set(bearer(customer))).body.data;
  assert.equal(hist.length, 2);
  assert.equal(hist[0].versionNumber, 2); assert.equal(hist[0].isCurrent, true); assert.equal(hist[0].status, 'PENDING');
  assert.equal(hist[1].versionNumber, 1); assert.equal(hist[1].isCurrent, false); assert.equal(hist[1].status, 'REJECTED');
  assert.equal(hist[1].items.length, 2); assert.equal(hist[1].totalAmount, v1.totalAmount);

  // v3 supersedes pending v2; approving the OLD v2 must fail (stale)
  const v3 = await quote(b.id, tech1.token, { notes: 'Final offer', revisionNotes: 'Added a gasket' });
  assert.equal(v3.body.data.versionNumber, 3);
  const stale = await post(`/api/quotations/${v2.body.data.id}/approve`, customer);
  assert.equal(stale.status, 409); assert.equal(stale.body.error.code, 'QUOTATION_STALE');

  // another customer cannot decide it
  const other = await register(ctx.api, 'CUSTOMER');
  assert.equal((await post(`/api/quotations/${v3.body.data.id}/approve`, other.token)).status, 404);
  assert.equal((await post(`/api/quotations/${v3.body.data.id}/approve`, tech1.token)).status, 403, 'technician cannot approve');
  assert.equal((await ctx.api.get(`/api/quotations/${v3.body.data.id}`).set(bearer(other.token))).status, 404);

  const ok = await post(`/api/quotations/${v3.body.data.id}/approve`, customer);
  assert.equal(ok.status, 200); assert.equal(ok.body.data.status, 'APPROVED');
  assert.equal((await post(`/api/quotations/${v3.body.data.id}/approve`, customer)).status, 409, 'double approval blocked');
  const [[cur]] = await ctx.pool.query('SELECT COUNT(*) c FROM quotations WHERE booking_id = ? AND is_current = 1', [b.id]);
  assert.equal(cur.c, 1, 'exactly one current version');
});

test('CONCURRENCY: simultaneous approve and reject of the same quotation - only one decision is recorded', async () => {
  const { b, q } = await jobAtQuotation();
  const res = await Promise.all([post(`/api/quotations/${q.id}/approve`, customer), post(`/api/quotations/${q.id}/reject`, customer, { reason: 'Changed my mind' })]);
  assert.deepEqual(res.map((r) => r.status).sort(), [200, 409]);
  const [[row]] = await ctx.pool.query('SELECT COUNT(*) c FROM booking_status_history WHERE booking_id = ? AND to_status IN (?,?)', [b.id, 'QUOTATION_APPROVED', 'QUOTATION_REJECTED']);
  assert.equal(row.c, 1);
});

test('CONCURRENCY: simultaneous quotation revisions get unique sequential versions and one current row', async () => {
  const { b } = await jobAtQuotation();
  const res = await Promise.all([1, 2, 3].map((i) => quote(b.id, tech1.token, { notes: `rev ${i}`, revisionNotes: `rev ${i}` })));
  assert.ok(res.every((r) => r.status === 201), JSON.stringify(res.map((r) => r.body)));
  const [rows] = await ctx.pool.query('SELECT version_number, is_current, status FROM quotations WHERE booking_id = ? ORDER BY version_number', [b.id]);
  assert.deepEqual(rows.map((r) => r.version_number), [1, 2, 3, 4]);
  assert.equal(rows.filter((r) => r.is_current).length, 1);
  assert.equal(rows.at(-1).is_current, 1);
});

test('work cannot start or complete without approval; completion, payment, duplicate protection', async () => {
  const { b, q } = await jobAtQuotation();
  assert.equal((await post(`/api/bookings/${b.id}/status`, tech1.token, { status: 'IN_PROGRESS' })).status, 409);
  assert.equal((await post(`/api/bookings/${b.id}/complete`, tech1.token, { completionNotes: 'done' })).status, 409);
  assert.equal((await post(`/api/bookings/${b.id}/status`, tech1.token, { status: 'COMPLETED' })).status, 400, 'COMPLETED is not a manual status');
  assert.equal((await post(`/api/bookings/${b.id}/status`, customer, { status: 'IN_PROGRESS' })).status, 403, 'customer cannot set technician states');
  await post(`/api/quotations/${q.id}/approve`, customer);
  assert.equal((await post(`/api/bookings/${b.id}/status`, tech2.token, { status: 'IN_PROGRESS' })).status, 404, 'other technician blocked');
  assert.equal((await post(`/api/bookings/${b.id}/status`, tech1.token, { status: 'IN_PROGRESS' })).status, 200);

  // payment before completion is refused
  assert.equal((await post('/api/payments', customer, { bookingId: b.id, method: 'DEMO_CARD' })).status, 409);
  // review before completion is refused
  assert.equal((await post('/api/reviews', customer, { bookingId: b.id, rating: 5 })).status, 409);

  assert.equal((await post(`/api/bookings/${b.id}/complete`, customer, { completionNotes: 'done' })).status, 403);
  const done = await post(`/api/bookings/${b.id}/complete`, tech1.token, { completionNotes: 'Replaced washer and tested' });
  assert.equal(done.status, 200); assert.equal(done.body.data.status, 'COMPLETED'); assert.ok(done.body.data.completedAt);
  assert.equal((await post(`/api/bookings/${b.id}/complete`, tech1.token, { completionNotes: 'again' })).status, 409);
  assert.equal((await post(`/api/bookings/${b.id}/cancel`, customer, {})).status, 409, 'completed booking cannot be cancelled');

  // payment input hardening: no client-declared status, amount or card data
  for (const extra of [{ status: 'PAID' }, { amount: '1.00' }, { cardNumber: '4111111111111111' }, { cvv: '123' }]) {
    assert.equal((await post('/api/payments', customer, { bookingId: b.id, method: 'DEMO_CARD', ...extra })).status, 400, JSON.stringify(extra));
  }
  assert.equal((await post('/api/payments', tech1.token, { bookingId: b.id, method: 'DEMO_CARD' })).status, 403);
  const other = await register(ctx.api, 'CUSTOMER');
  assert.equal((await post('/api/payments', other.token, { bookingId: b.id, method: 'DEMO_CARD' })).status, 404);

  // a failed attempt is recorded and does not mark the booking paid
  const failed = await post('/api/payments', customer, { bookingId: b.id, method: 'DEMO_FAILING_CARD' });
  assert.equal(failed.status, 402); assert.equal(failed.body.data.payment.status, 'FAILED');
  assert.equal((await ctx.api.get(`/api/bookings/${b.id}`).set(bearer(customer))).body.data.paymentStatus, 'UNPAID');

  // CONCURRENCY: five simultaneous payment attempts -> exactly one success
  const pays = await Promise.all(Array.from({ length: 5 }, () => post('/api/payments', customer, { bookingId: b.id, method: 'DEMO_UPI' })));
  assert.equal(pays.filter((p) => p.status === 201).length, 1, JSON.stringify(pays.map((p) => p.status)));
  assert.ok(pays.filter((p) => p.status !== 201).every((p) => p.status === 409 && p.body.error.code === 'ALREADY_PAID'));
  const good = pays.find((p) => p.status === 201).body.data.payment;
  assert.equal(good.amount, '872.61', 'amount is always the approved quotation total'); assert.equal(good.isSimulated, true); assert.match(good.notice, /no real money/i);
  assert.match(good.transactionReference, /^SIM-/);
  const [[cnt]] = await ctx.pool.query("SELECT COUNT(*) c FROM payments WHERE booking_id = ? AND status = 'SUCCESS'", [b.id]);
  assert.equal(cnt.c, 1);
  const bk = (await ctx.api.get(`/api/bookings/${b.id}`).set(bearer(customer))).body.data;
  assert.equal(bk.paymentStatus, 'PAID'); assert.equal(bk.payment.amount, '872.61');
  assert.equal((await post('/api/payments', customer, { bookingId: b.id, method: 'DEMO_CARD' })).status, 409);

  // visibility of payments
  const mine = await ctx.api.get('/api/payments').set(bearer(customer));
  assert.ok(mine.body.data.length >= 2); // failed + success
  assert.equal((await ctx.api.get(`/api/payments/${good.id}`).set(bearer(other.token))).status, 404);
  assert.equal((await ctx.api.get(`/api/payments/${good.id}`).set(bearer(tech1.token))).status, 200);
  assert.equal((await ctx.api.get(`/api/payments/${good.id}`).set(bearer(tech2.token))).status, 404);
  assert.equal((await ctx.api.get(`/api/payments/${good.id}`).set(bearer(admin))).status, 200);
  const earn = await ctx.api.get('/api/technicians/me/earnings').set(bearer(tech1.token));
  assert.equal(earn.body.data.isSimulated, true); assert.ok(Number(earn.body.data.totalAmount) >= 872.61);

  // reviews: eligible now, one per booking, validated, moderated
  assert.equal((await post('/api/reviews', customer, { bookingId: b.id, rating: 6 })).status, 400);
  assert.equal((await post('/api/reviews', other.token, { bookingId: b.id, rating: 5 })).status, 404);
  const rev = await post('/api/reviews', customer, { bookingId: b.id, rating: 5, comment: 'Quick and tidy work' });
  assert.equal(rev.status, 201);
  assert.equal((await post('/api/reviews', customer, { bookingId: b.id, rating: 4 })).status, 409);
  const pub = await ctx.api.get(`/api/reviews?serviceId=${serviceId}`);
  assert.equal(pub.body.data.length, 1); assert.equal(pub.body.data[0].reviewer.includes(' '), false, 'only first name is public');
  assert.equal((await ctx.api.patch(`/api/reviews/${rev.body.data.id}/moderation`).set(bearer(customer)).send({ status: 'HIDDEN' })).status, 403);
  assert.equal((await ctx.api.patch(`/api/reviews/${rev.body.data.id}/moderation`).set(bearer(admin)).send({ status: 'HIDDEN', note: 'test' })).status, 200);
  assert.equal((await ctx.api.get(`/api/reviews?serviceId=${serviceId}`)).body.data.length, 0, 'hidden reviews are not public');

  // notifications persisted for the whole lifecycle
  const types = (await ctx.api.get('/api/notifications?pageSize=100').set(bearer(customer))).body.data.map((n) => n.type);
  for (const t of ['TECHNICIAN_ASSIGNED', 'INSPECTION_COMPLETED', 'QUOTATION_CREATED', 'QUOTATION_APPROVED', 'SERVICE_COMPLETED', 'PAYMENT_COMPLETED']) assert.ok(types.includes(t), `missing ${t}`);
  const techTypes = (await ctx.api.get('/api/notifications?pageSize=100').set(bearer(tech1.token))).body.data.map((n) => n.type);
  assert.ok(techTypes.includes('QUOTATION_APPROVED') && techTypes.includes('REVIEW_RECEIVED'));
});

test('additional work: revising an approved quotation mid-job requires notes and a new approval', async () => {
  const { b, q } = await jobAtQuotation();
  await post(`/api/quotations/${q.id}/approve`, customer);
  await post(`/api/bookings/${b.id}/status`, tech1.token, { status: 'IN_PROGRESS' });
  assert.equal((await quote(b.id, tech1.token)).status, 422, 'revision notes required');
  const rev = await quote(b.id, tech1.token, { items: [...items, { itemType: 'ADDITIONAL', description: 'Extra pipe section', quantity: '1', unitPrice: '200.00' }], revisionNotes: 'Found corroded pipe' });
  assert.equal(rev.status, 201);
  const bk = (await ctx.api.get(`/api/bookings/${b.id}`).set(bearer(customer))).body.data;
  assert.equal(bk.status, 'QUOTATION_SENT');
  assert.equal((await post(`/api/bookings/${b.id}/complete`, tech1.token, { completionNotes: 'finished' })).status, 409, 'cannot complete while the new price is unapproved');
  const hist = (await ctx.api.get(`/api/bookings/${b.id}/quotations`).set(bearer(customer))).body.data;
  assert.equal(hist.find((h) => h.versionNumber === 1).status, 'SUPERSEDED');
});

test('cancellation rules: customer may cancel early, pending quotation is withdrawn, history recorded', async () => {
  const { b, q } = await jobAtQuotation();
  assert.equal((await post(`/api/bookings/${b.id}/cancel`, tech1.token, {})).status, 403);
  const c = await post(`/api/bookings/${b.id}/cancel`, customer, { reason: 'No longer needed' });
  assert.equal(c.status, 200); assert.equal(c.body.data.status, 'CANCELLED');
  assert.equal((await post(`/api/quotations/${q.id}/approve`, customer)).status, 409);
  const [[row]] = await ctx.pool.query('SELECT status FROM quotations WHERE id = ?', [q.id]);
  assert.equal(row.status, 'WITHDRAWN');
  assert.equal(c.body.data.history.at(-1).toStatus, 'CANCELLED');
});

test('admin assignment, booking management and technician deactivation', async () => {
  const b = (await book()).body.data;
  const prof = await ctx.api.get('/api/technicians/me').set(bearer(tech2.token));
  const asg = await post(`/api/bookings/${b.id}/assign`, admin, { technicianId: prof.body.data.id });
  assert.equal(asg.status, 200); assert.equal(asg.body.data.technician.id, prof.body.data.id);
  assert.equal((await post(`/api/bookings/${b.id}/assign`, customer, { technicianId: prof.body.data.id })).status, 403);
  const all = await ctx.api.get('/api/bookings?pageSize=100').set(bearer(admin));
  assert.ok(all.body.meta.total >= 1);
  // deactivated technicians cannot work anymore, even though approved
  assert.equal((await ctx.api.patch(`/api/technicians/${prof.body.data.id}/active`).set(bearer(admin)).send({ isActive: false })).status, 200);
  const b2 = (await book()).body.data;
  const r = await post(`/api/bookings/${b2.id}/accept`, tech2.token);
  assert.equal(r.status, 403); assert.equal(r.body.error.code, 'TECHNICIAN_NOT_APPROVED');
  await ctx.api.patch(`/api/technicians/${prof.body.data.id}/active`).set(bearer(admin)).send({ isActive: true });
});
