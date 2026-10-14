// Page sweep: opens EVERY route for EVERY role (with data in many booking states) and fails on
//  - the app's last-resort error screen, any uncaught error / console.error / failed request, or a page with no <h1>.
// This exists because a page crash (approved technician dashboard) once slipped past targeted tests.
//   CHROME_PATH=... APP_URL=http://localhost:4173 API_URL=http://localhost:5055/api node e2e/ui-sweep.mjs
import path from 'node:path';
import { createHarness, sleep } from './helpers.mjs';
import { createSetupApi } from './setup-api.mjs';

const APP = process.env.APP_URL ?? 'http://localhost:4173';
const API = process.env.API_URL ?? 'http://localhost:5055/api';
const h = await createHarness({ app: APP, api: API, chrome: process.env.CHROME_PATH, shots: process.env.SHOTS_DIR ?? path.join(process.cwd(), 'e2e', 'screenshots') });
const s = createSetupApi(API);

// ---- fixtures: one of each interesting state ----
const admin = await s.login('admin@fixnow.test');
const leak = (await s.call('/services?q=Leak')).data[0];
const tech = await s.approvedTechnician(admin.token, [leak.id], 'Sweep Technician');
const cust = await s.customerWithAddress('Sweep Customer');
const states = {};
for (const st of ['PENDING', 'ASSIGNED', 'QUOTATION_SENT', 'QUOTATION_APPROVED', 'IN_PROGRESS', 'COMPLETED', 'PAID']) states[st] = await s.jobAt(st, { customer: cust, tech, serviceId: leak.id });
await s.call('/reviews', { method: 'POST', token: cust.token, body: { bookingId: states.PAID.id, rating: 5, comment: 'Sweep review' } });
const rej = await s.jobAt('QUOTATION_SENT', { customer: cust, tech, serviceId: leak.id }); await s.call(`/quotations/${rej.quotationId}/reject`, { method: 'POST', token: cust.token, body: { reason: 'Too expensive for me' } });
states.REJECTED = rej;
const cancelled = await s.book(cust, leak.id); await s.call(`/bookings/${cancelled.id}/cancel`, { method: 'POST', token: cust.token, body: { reason: 'Sweep cancel' } }); states.CANCELLED = cancelled;
await s.call('/availability', { method: 'PUT', token: tech.token, body: { slots: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isAvailable: true }] } });
const pendingTech = await s.register('TECHNICIAN', 'Sweep Unapplied'); const appliedTech = await s.register('TECHNICIAN', 'Sweep Applicant'); const app = await s.submitApplication(appliedTech.token, [leak.id], 'Sweep Applicant');
const tokens = { CUSTOMER: cust.token, TECHNICIAN: tech.token, ADMIN: admin.token, TECH_UNAPPLIED: pendingTech.token, TECH_PENDING: appliedTech.token };

const pages = [
  [null, '/'], [null, '/services'], [null, `/services/${leak.id}`], [null, '/services/999999'], [null, '/how-it-works'], [null, '/about'], [null, '/contact'], [null, '/privacy'], [null, '/terms'],
  [null, '/login'], [null, '/register'], [null, '/register?role=TECHNICIAN'], [null, '/forgot-password'], [null, '/reset-password?token=abc'], [null, '/unauthorized'], [null, '/server-error'], [null, '/no-such-page'],
  ...['', '/book', '/book?serviceId=' + leak.id, '/bookings', '/addresses', '/payments', '/reviews', '/notifications', '/profile'].map((p) => ['CUSTOMER', `/customer${p}`]),
  ...Object.entries(states).map(([k, b]) => ['CUSTOMER', `/customer/bookings/${b.id}`, `booking ${k}`]), ['CUSTOMER', '/customer/bookings/999999'],
  ...['', '/application', '/jobs/available', '/jobs', '/availability', '/earnings', '/reviews', '/notifications', '/profile'].map((p) => ['TECHNICIAN', `/technician${p}`]),
  ...Object.entries(states).map(([k, b]) => ['TECHNICIAN', `/technician/jobs/${b.id}`, `job ${k}`]),
  ...['', '/application', '/jobs/available', '/profile'].map((p) => ['TECH_UNAPPLIED', `/technician${p}`]), ...['', '/application', '/jobs/available'].map((p) => ['TECH_PENDING', `/technician${p}`]),
  ...['', '/users', '/applications', `/applications/${app.id}`, '/technicians', '/categories', '/services', '/bookings', '/quotations', '/payments', '/reviews', '/reports', '/settings', '/audit-logs', '/notifications', '/profile'].map((p) => ['ADMIN', `/admin${p}`]),
  ...Object.entries(states).map(([k, b]) => ['ADMIN', `/admin/bookings/${b.id}`, `booking ${k}`]),
];

let failures = 0; const t0 = Date.now();
for (const [role, route, note] of pages) {
  const label = `${role ?? 'public'} ${route}${note ? ` (${note})` : ''}`;
  const before = h.problems.length;
  const page = await h.newSession(label);
  if (role) await page.evaluateOnNewDocument((t) => sessionStorage.setItem('fixnow.session', t), tokens[role]);
  let err = '';
  try {
    await page.goto(APP + route, { waitUntil: 'networkidle0' }); await sleep(250);
    const text = await h.textOf(page);
    if (/Something broke on our side/.test(text)) err = 'last-resort error screen';
    else if (!(await page.evaluate(() => !!document.querySelector('h1')))) err = 'no <h1> on the page';
    else if (/Cannot reach the FixNow server/.test(text)) err = 'API unreachable message shown';
    else if (/Could not load this page/.test(text) && !/999999/.test(route)) err = 'a "could not load" error state is shown';
  } catch (e) { err = e.message; }
  const fresh = h.problems.slice(before);
  if (fresh.length && !err) err = `browser errors: ${fresh.join(' || ').slice(0, 300)}`;
  if (err) { failures++; console.log(`  FAIL ${label}: ${err}`); } else console.log(`  ok   ${label}`);
  await page.ctx.close();
}
console.log(`\nswept ${pages.length} pages in ${Math.round((Date.now() - t0) / 1000)}s: ${pages.length - failures} clean, ${failures} failed`);
await h.browser.close(); process.exit(failures ? 1 : 0);
