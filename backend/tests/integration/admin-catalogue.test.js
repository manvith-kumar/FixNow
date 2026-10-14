import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, login, bearer, register, approvedTechnician, futureDate } from '../helpers.js';

let ctx, admin, customer;
before(async () => { ctx = await bootApp(); admin = await login(ctx.api, 'admin@fixnow.test'); customer = await login(ctx.api, 'customer@fixnow.test'); });
after(async () => { await ctx.close(); });
const post = (p, t, b = {}) => ctx.api.post(p).set(bearer(t)).send(b);

test('public catalogue: search, filter, pagination and indicative-price disclaimer', async () => {
  const all = await ctx.api.get('/api/services?pageSize=5&page=2');
  assert.equal(all.status, 200); assert.equal(all.body.meta.page, 2); assert.equal(all.body.data.length, 5);
  const q = await ctx.api.get('/api/services?q=washing');
  assert.equal(q.body.data.length, 1); assert.match(q.body.data[0].priceDisclaimer, /Indicative only/);
  const cats = await ctx.api.get('/api/categories');
  assert.ok(cats.body.data.length >= 6);
  const byCat = await ctx.api.get(`/api/services?categoryId=${cats.body.data[0].id}`);
  assert.ok(byCat.body.data.every((s) => s.categoryId === cats.body.data[0].id));
  assert.equal((await ctx.api.get('/api/services?pageSize=1000')).status, 400, 'page size is capped');
  assert.equal((await ctx.api.get('/api/services?sortBy=password')).status, 400, 'sort fields are whitelisted');
});
test('admin catalogue management; deactivated items disappear publicly but stay in history', async () => {
  const c = await post('/api/categories', admin, { name: 'Gardening', description: 'Garden care' });
  assert.equal(c.status, 201);
  assert.equal((await post('/api/categories', admin, { name: 'Gardening' })).status, 409);
  const s = await post('/api/services', admin, { categoryId: c.body.data.id, name: 'Lawn Mowing', indicativeStartingPrice: '150.00' });
  assert.equal(s.status, 201); assert.equal(s.body.data.indicativeStartingPrice, '150.00');
  assert.equal((await post('/api/services', admin, { categoryId: c.body.data.id, name: 'Bad', indicativeStartingPrice: '-5' })).status, 400);
  assert.equal((await post('/api/services', admin, { categoryId: 99999, name: 'Orphan' })).status, 400);
  assert.equal((await post('/api/services', customer, { categoryId: c.body.data.id, name: 'Nope' })).status, 403);
  const upd = await ctx.api.patch(`/api/services/${s.body.data.id}`).set(bearer(admin)).send({ name: 'Lawn Mowing Pro', indicativeStartingPrice: '175.00' });
  assert.equal(upd.body.data.name, 'Lawn Mowing Pro'); assert.equal(upd.body.data.indicativeStartingPrice, '175.00');
  assert.equal((await ctx.api.get(`/api/services/${s.body.data.id}`)).status, 200);
  await ctx.api.patch(`/api/services/${s.body.data.id}`).set(bearer(admin)).send({ isActive: false });
  assert.equal((await ctx.api.get(`/api/services/${s.body.data.id}`)).status, 404, 'inactive hidden from public');
  assert.equal((await ctx.api.get(`/api/services/${s.body.data.id}`).set(bearer(admin))).status, 200, 'admin still sees it');
  const addr = (await ctx.api.get('/api/addresses').set(bearer(customer))).body.data[0].id;
  const bk = await post('/api/bookings', customer, { serviceId: s.body.data.id, addressId: addr, problemDescription: 'Lawn is overgrown badly', preferredDate: futureDate(), preferredTime: '09:00' });
  assert.equal(bk.status, 400, 'cannot book an inactive service');
  // deactivating a category hides its services
  const svc = (await ctx.api.get('/api/services?q=Leak')).body.data[0];
  await ctx.api.patch(`/api/categories/${svc.categoryId}`).set(bearer(admin)).send({ isActive: false });
  assert.equal((await ctx.api.get(`/api/services/${svc.id}`)).status, 404);
  await ctx.api.patch(`/api/categories/${svc.categoryId}`).set(bearer(admin)).send({ isActive: true });
});
test('addresses: default handling, coordinates validation, delete safety', async () => {
  const u = await register(ctx.api, 'CUSTOMER');
  const a1 = await post('/api/addresses', u.token, { line1: '1 First Street', city: 'Guntur', latitude: 16.3, longitude: 80.43 });
  assert.equal(a1.body.data.isDefault, true); assert.equal(a1.body.data.latitude, 16.3);
  const a2 = await post('/api/addresses', u.token, { label: 'Office', line1: '2 Second Street', city: 'Guntur', isDefault: true });
  const list = (await ctx.api.get('/api/addresses').set(bearer(u.token))).body.data;
  assert.equal(list.filter((a) => a.isDefault).length, 1); assert.equal(list.find((a) => a.isDefault).id, a2.body.data.id);
  assert.equal((await post('/api/addresses', u.token, { line1: '3 Third St', city: 'Guntur', latitude: 123, longitude: 10 })).status, 400);
  assert.equal((await post('/api/addresses', u.token, { line1: '3 Third St', city: 'Guntur', latitude: 12 })).status, 400);
  const svc = (await ctx.api.get('/api/services?q=Leak')).body.data[0];
  await post('/api/bookings', u.token, { serviceId: svc.id, addressId: a2.body.data.id, problemDescription: 'Pipe under sink leaks', preferredDate: futureDate(), preferredTime: '12:00' });
  const del = await ctx.api.delete(`/api/addresses/${a2.body.data.id}`).set(bearer(u.token));
  assert.equal(del.status, 409); assert.equal(del.body.error.code, 'ADDRESS_IN_USE');
  assert.equal((await ctx.api.delete(`/api/addresses/${a1.body.data.id}`).set(bearer(u.token))).status, 200);
  assert.equal((await ctx.api.get('/api/addresses').set(bearer(admin))).status, 403);
});
test('technician availability: validation, overlap rule, replace semantics', async () => {
  const t = await approvedTechnician(ctx.api, admin, [(await ctx.api.get('/api/services?q=Leak')).body.data[0].id]);
  const put = (slots, tok = t.token) => ctx.api.put('/api/availability').set(bearer(tok)).send({ slots });
  const ok = await put([{ dayOfWeek: 1, startTime: '09:00', endTime: '13:00' }, { dayOfWeek: 1, startTime: '14:00', endTime: '18:00' }, { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }]);
  assert.equal(ok.status, 200); assert.equal(ok.body.data.length, 3);
  assert.equal((await put([{ dayOfWeek: 1, startTime: '09:00', endTime: '13:00' }, { dayOfWeek: 1, startTime: '12:00', endTime: '15:00' }])).status, 400);
  assert.equal((await put([{ dayOfWeek: 9, startTime: '09:00', endTime: '13:00' }])).status, 400);
  assert.equal((await put([{ dayOfWeek: 1, startTime: '13:00', endTime: '09:00' }])).status, 400);
  assert.equal((await put([{ dayOfWeek: 3, startTime: '10:00', endTime: '12:00' }])).body.data.length, 1, 'PUT replaces');
  assert.equal((await put([], customer)).status, 403);
});
test('notifications: ownership, mark one read, mark all read', async () => {
  const a = await register(ctx.api, 'CUSTOMER'), b = await register(ctx.api, 'CUSTOMER');
  const addr = (await post('/api/addresses', a.token, { line1: '5 Fifth Street', city: 'Guntur' })).body.data.id;
  const svc = (await ctx.api.get('/api/services?q=Leak')).body.data[0];
  for (let i = 0; i < 2; i++) await post('/api/bookings', a.token, { serviceId: svc.id, addressId: addr, problemDescription: 'Leaking pipe in kitchen', preferredDate: futureDate(), preferredTime: '11:00' });
  const list = await ctx.api.get('/api/notifications').set(bearer(a.token));
  assert.equal(list.body.meta.unread, 2);
  assert.equal((await ctx.api.get('/api/notifications').set(bearer(b.token))).body.data.length, 0);
  assert.equal((await post(`/api/notifications/${list.body.data[0].id}/read`, b.token)).status, 404, "cannot mark another user's notification");
  assert.equal((await post(`/api/notifications/${list.body.data[0].id}/read`, a.token)).status, 200);
  assert.equal((await ctx.api.get('/api/notifications?unreadOnly=true').set(bearer(a.token))).body.data.length, 1);
  assert.equal((await post('/api/notifications/read-all', a.token)).body.data.updated, 1);
  assert.equal((await ctx.api.get('/api/notifications').set(bearer(a.token))).body.meta.unread, 0);
});
test('admin dashboard + reports are DB-backed and consistent with the workflow data', async () => {
  const before = (await ctx.api.get('/api/admin/dashboard').set(bearer(admin))).body.data;
  assert.equal(before.isSimulated, true); assert.match(before.revenueDefinition, /SUCCESSFUL/);
  const tech = await approvedTechnician(ctx.api, admin, [(await ctx.api.get('/api/services?q=Leak')).body.data[0].id]);
  const svc = (await ctx.api.get('/api/services?q=Leak')).body.data[0];
  const addr = (await ctx.api.get('/api/addresses').set(bearer(customer))).body.data[0].id;
  const b = (await post('/api/bookings', customer, { serviceId: svc.id, addressId: addr, problemDescription: 'Pipe is leaking in bathroom', preferredDate: futureDate(), preferredTime: '10:00' })).body.data;
  await post(`/api/bookings/${b.id}/accept`, tech.token);
  await post(`/api/bookings/${b.id}/inspection`, tech.token, { diagnosis: 'Loose joint', observedCondition: 'Dripping joint' });
  const q = (await post('/api/quotations', tech.token, { bookingId: b.id, items: [{ itemType: 'LABOUR', description: 'Repair joint', quantity: '1', unitPrice: '400' }] })).body.data;
  const mid = (await ctx.api.get('/api/admin/dashboard').set(bearer(admin))).body.data;
  assert.equal(mid.quotationsAwaitingDecision, before.quotationsAwaitingDecision + 1);
  await post(`/api/quotations/${q.id}/approve`, customer);
  await post(`/api/bookings/${b.id}/status`, tech.token, { status: 'IN_PROGRESS' });
  await post(`/api/bookings/${b.id}/complete`, tech.token, { completionNotes: 'Joint tightened' });
  await post('/api/payments', customer, { bookingId: b.id, method: 'DEMO_FAILING_CARD' });
  const afterFail = (await ctx.api.get('/api/admin/dashboard').set(bearer(admin))).body.data;
  assert.equal(afterFail.payments.simulatedCollectedTotal, before.payments.simulatedCollectedTotal, 'failed payments are NOT revenue');
  await post('/api/payments', customer, { bookingId: b.id, method: 'DEMO_WALLET' });
  const end = (await ctx.api.get('/api/admin/dashboard').set(bearer(admin))).body.data;
  assert.equal(end.totalBookings, before.totalBookings + 1); assert.equal(end.completedBookings, before.completedBookings + 1);
  assert.equal(Number(end.payments.simulatedCollectedTotal) - Number(before.payments.simulatedCollectedTotal), 400);
  assert.equal(end.payments.failed, before.payments.failed + 1);
  assert.equal(end.bookingsByStatus.COMPLETED, end.completedBookings);

  for (const type of ['booking-volume', 'service-demand', 'technician-workload', 'completed-cancelled', 'quotation-rates', 'payments-summary']) {
    const r = await ctx.api.get(`/api/admin/reports/${type}`).set(bearer(admin));
    assert.equal(r.status, 200, type); assert.equal(r.body.data.timezone, 'UTC'); assert.ok(Array.isArray(r.body.data.rows));
  }
  const pay = (await ctx.api.get('/api/admin/reports/payments-summary').set(bearer(admin))).body.data.rows;
  assert.equal(Number(pay.reduce((s, r) => s + Number(r.collected), 0)), Number(end.payments.simulatedCollectedTotal));
  const demand = (await ctx.api.get('/api/admin/reports/service-demand').set(bearer(admin))).body.data.rows.find((r) => r.service === 'Leak Repair');
  assert.ok(Number(demand.completed) >= 1);
  const csv = await ctx.api.get('/api/admin/reports/service-demand?format=csv').set(bearer(admin));
  assert.match(csv.headers['content-type'], /text\/csv/); assert.match(csv.text, /^Category,Service,Bookings,Completed,Cancelled/);
  assert.equal((await ctx.api.get('/api/admin/reports/unknown').set(bearer(admin))).status, 404);
  assert.equal((await ctx.api.get('/api/admin/reports/booking-volume?from=2026-02-01&to=2026-01-01').set(bearer(admin))).status, 400);
  assert.equal((await ctx.api.get('/api/admin/reports/booking-volume').set(bearer(customer))).status, 403);
});
test('settings are validated and audited; audit log is admin-only', async () => {
  assert.equal((await ctx.api.put('/api/admin/settings').set(bearer(admin)).send({ values: { quotation_validity_days: '14', default_tax_rate: '12.5' } })).status, 200);
  assert.equal((await ctx.api.put('/api/admin/settings').set(bearer(admin)).send({ values: { quotation_validity_days: '500' } })).status, 400);
  assert.equal((await ctx.api.put('/api/admin/settings').set(bearer(admin)).send({ values: { jwt_secret: 'x' } })).status, 400);
  assert.equal((await ctx.api.put('/api/admin/settings').set(bearer(customer)).send({ values: { currency: 'USD' } })).status, 403);
  assert.equal((await ctx.api.get('/api/settings/public')).body.data.quotation_validity_days, '14');
  const log = await ctx.api.get('/api/admin/audit-logs').set(bearer(admin));
  assert.ok(log.body.data.some((l) => l.action === 'SETTINGS_UPDATED') && log.body.data.some((l) => l.action === 'APPLICATION_APPROVE'));
  assert.equal((await ctx.api.get('/api/admin/audit-logs').set(bearer(customer))).status, 403);
});
test('users admin: list/filter/search and technician details', async () => {
  const r = await ctx.api.get('/api/users?role=TECHNICIAN&q=tech&pageSize=5').set(bearer(admin));
  assert.equal(r.status, 200); assert.ok(r.body.data.every((u) => u.role === 'TECHNICIAN')); assert.ok(!JSON.stringify(r.body).includes('password'));
  const t = await ctx.api.get('/api/technicians?status=APPROVED').set(bearer(admin));
  assert.ok(t.body.data.length >= 1);
  assert.equal((await ctx.api.get(`/api/technicians/${t.body.data[0].id}`).set(bearer(admin))).status, 200);
});
