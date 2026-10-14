// Extended real-browser scenarios for flows the main journey (ui-smoke.mjs) does not cover.
// Needs: backend running with seed data, built frontend served by `npm run preview`, CHROME_PATH.
//   APP_URL (default http://localhost:4173)  API_URL (default http://localhost:5055/api)  CHROME_PATH  SHOTS_DIR
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHarness, sleep } from './helpers.mjs';
import { createSetupApi } from './setup-api.mjs';

const APP = process.env.APP_URL ?? 'http://localhost:4173';
const API = process.env.API_URL ?? 'http://localhost:5055/api';
const PDF = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sample-id.pdf');
const h = await createHarness({ app: APP, api: API, chrome: process.env.CHROME_PATH, shots: process.env.SHOTS_DIR ?? path.join(process.cwd(), 'e2e', 'screenshots') });
const { step, go, fill, choose, expectText, expectNoText, clickButton, login, textOf } = h;
const s = createSetupApi(API);
const run = (name, fn) => step(name, fn).catch(() => {}); // keep going so every scenario reports

const rowAction = async (page, rowText, btnText) => {
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    const el = (await page.evaluateHandle((r, b) => { const tr = [...document.querySelectorAll('tbody tr')].find((x) => x.textContent.includes(r)); return tr ? [...tr.querySelectorAll('button')].find((x) => x.textContent.trim() === b && !x.disabled) ?? null : null; }, rowText, btnText)).asElement();
    if (el) { await el.click(); return; } await sleep(150);
  }
  throw new Error(`row "${rowText}" button "${btnText}" not found`);
};
const clickLink = async (page, text, scope = 'main') => { const el = (await page.evaluateHandle((t, sc) => [...document.querySelector(sc).querySelectorAll('a')].find((a) => a.textContent.trim() === t) ?? null, text, scope)).asElement(); if (!el) throw new Error(`link "${text}" not found`); await el.click(); };

// ---------- shared fixtures (created through the API for speed) ----------
const admin = await s.login('admin@fixnow.test');
const leak = (await s.call('/services?q=Leak')).data[0];
const tech = await s.approvedTechnician(admin.token, [leak.id], 'Ext Technician');
const cust = await s.customerWithAddress('Ext Customer');
const adminPage = await h.newSession('admin'); const custPage = await h.newSession('customer'); const techPage = await h.newSession('technician');
await login(adminPage, 'admin@fixnow.test'); await login(custPage, cust.email, 'Secret123'); await login(techPage, tech.email, 'Secret123');

console.log('Customer account flows');
await run('addresses: add, make default, edit, delete; an address used by a booking cannot be deleted', async () => {
  await s.book(cust, leak.id);
  await go(custPage, '/customer/addresses'); await clickButton(custPage, 'Add address');
  await fill(custPage, 'Label', 'Office'); await fill(custPage, 'Address line 1', '99 Office Road'); await fill(custPage, 'City', 'Vijayawada'); await clickButton(custPage, 'Save address');
  await expectText(custPage, /99 Office Road/);
  const card = async (txt, btn) => { const el = (await custPage.evaluateHandle((t, b) => [...document.querySelectorAll('.panel')].find((p) => p.textContent.includes(t) && [...p.querySelectorAll('button')].some((x) => x.textContent.trim() === b)) ? [...[...document.querySelectorAll('.panel')].find((p) => p.textContent.includes(t) && [...p.querySelectorAll('button')].some((x) => x.textContent.trim() === b)).querySelectorAll('button')].find((x) => x.textContent.trim() === b) : null, txt, btn)).asElement(); if (!el) throw new Error(`${btn} for ${txt}`); await el.click(); };
  await card('99 Office Road', 'Make default'); await expectText(custPage, /Default address updated/);
  await card('99 Office Road', 'Edit'); await fill(custPage, 'City', 'Tenali'); await clickButton(custPage, 'Save address'); await expectText(custPage, /Tenali/);
  await card('5 Setup Street', 'Delete'); await clickButton(custPage, 'Delete address'); await expectText(custPage, /used by existing bookings/i);
  await clickButton(custPage, 'Keep it');
  await card('99 Office Road', 'Delete'); await clickButton(custPage, 'Delete address'); await expectText(custPage, /Address deleted/); await expectNoText(custPage, /99 Office Road/);
});
await run('profile: name change shows in the header; password change works with the new password', async () => {
  await go(custPage, '/customer/profile'); await fill(custPage, 'Full name', 'Ext Customer Renamed'); await clickButton(custPage, 'Save changes'); await expectText(custPage, /Profile updated/);
  await go(custPage, '/customer'); await expectText(custPage, /Hello, Ext/); const t = await textOf(custPage); if (!/Ext Customer Renamed/.test(t)) throw new Error('new name not shown in the top bar');
  await go(custPage, '/customer/profile'); await clickButton(custPage, 'Change password'); await expectText(custPage, /Enter your current password/);
  await fill(custPage, 'Current password', 'Secret123'); await fill(custPage, 'New password', 'Secret456'); await fill(custPage, 'Confirm new password', 'Secret456'); await clickButton(custPage, 'Change password'); await expectText(custPage, /Password changed/);
  Object.assign(cust, await s.login(cust.email, 'Secret456')); cust.password = 'Secret456'; // the old API token was (correctly) revoked by the password change
  const token = await custPage.evaluate(() => sessionStorage.getItem('fixnow.session')); const me = await fetch(`${API}/auth/me`, { headers: { authorization: `Bearer ${token}` } }); if (me.status !== 200) throw new Error('session should stay valid after changing the password (fresh token issued)');
});
await run('forgot password: dev flow -> reset page -> login with the new password', async () => {
  const u = await s.register('CUSTOMER', 'Forgetful Customer'); const p = await h.newSession('anon');
  await go(p, '/forgot-password'); await fill(p, 'Email', u.email); await clickButton(p, 'Send reset instructions');
  await expectText(p, /password reset instructions have been prepared/i); await expectText(p, /Development only/); await expectText(p, /No email service is connected/);
  await clickLink(p, 'Open the reset page'); await expectText(p, /Choose a new password/);
  await fill(p, 'New password', 'Fresh1234'); await fill(p, 'Confirm new password', 'Fresh1234'); await clickButton(p, 'Update password');
  await p.waitForFunction(() => location.pathname === '/login', { timeout: 6000 }); await expectText(p, /password was updated/i);
  await login(p, u.email, 'Fresh1234'); await p.ctx.close();
});
await run('forgot password: an unknown email gets the same generic message and no reset link', async () => {
  const p = await h.newSession('anon'); await go(p, '/forgot-password'); await fill(p, 'Email', 'nobody.here@t.dev'); await clickButton(p, 'Send reset instructions');
  await expectText(p, /password reset instructions have been prepared/i); const t = await textOf(p); if (/Open the reset page|Development only/.test(t)) throw new Error('reset link shown for an unknown email'); await p.ctx.close();
});
await run('booking: double-clicking the submit button creates exactly one booking', async () => {
  const before = (await s.call('/bookings?pageSize=1', { token: cust.token })).meta.total;
  await go(custPage, '/customer/book'); await choose(custPage, 'Service', 'Leak Repair'); await fill(custPage, 'Describe the problem', 'Double click test: water drips from the pipe.');
  const btn = (await custPage.evaluateHandle(() => [...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Book inspection'))).asElement(); await btn.click({ clickCount: 2, delay: 20 });
  await custPage.waitForFunction(() => /^\/customer\/bookings\/\d+/.test(location.pathname), { timeout: 8000 }); await sleep(800);
  const after = (await s.call('/bookings?pageSize=1', { token: cust.token })).meta.total; if (after !== before + 1) throw new Error(`expected ${before + 1} bookings, found ${after}`);
});
await run('booking: coordinates are sent when location permission is granted', async () => {
  const c = await s.customerWithAddress('Geo Customer'); const p = await h.newSession('geo', { permissions: ['geolocation'] }); await p.setGeolocation({ latitude: 16.3067, longitude: 80.4365 });
  await login(p, c.email, 'Secret123'); await go(p, '/customer/book'); await choose(p, 'Service', 'Leak Repair'); await fill(p, 'Describe the problem', 'Geolocation test: the tap leaks.');
  await clickButton(p, 'Use my current location'); await expectText(p, /16\.3067, 80\.4365/); await clickButton(p, 'Book inspection');
  await p.waitForFunction(() => /^\/customer\/bookings\/\d+/.test(location.pathname), { timeout: 8000 });
  const b = (await s.call('/bookings?pageSize=1', { token: c.token })).data[0]; if (b.latitude !== 16.3067 || b.longitude !== 80.4365) throw new Error(`stored ${b.latitude},${b.longitude}`); await p.ctx.close();
});
await run('booking: declined/unavailable location does not block booking', async () => {
  const c = await s.customerWithAddress('NoGeo Customer'); const p = await h.newSession('nogeo'); await login(p, c.email, 'Secret123'); await go(p, '/customer/book');
  await choose(p, 'Service', 'Leak Repair'); await fill(p, 'Describe the problem', 'No location test: the tap leaks.'); await clickButton(p, 'Use my current location');
  // an unanswered permission prompt is cut off by the app after 12s, hence the long wait below
  await expectText(p, /declined|Could not get your location|does not support|Still waiting/i, 16000); await clickButton(p, 'Book inspection'); await p.waitForFunction(() => /^\/customer\/bookings\/\d+/.test(location.pathname), { timeout: 8000 });
  const list = await s.call('/bookings?pageSize=5', { token: c.token }); const b = list.data[0];
  if (!b) throw new Error(`no booking found for ${c.email}; meta=${JSON.stringify(list.meta)}; page url=${p.url()}`);
  if (b.latitude !== null) throw new Error(`coordinates ${b.latitude},${b.longitude} were stored although the person never granted permission`); await p.ctx.close();
});
await run('customer cancels a pending booking through the dialog', async () => {
  const b = await s.book(cust, leak.id); await go(custPage, `/customer/bookings/${b.id}`); await clickButton(custPage, 'Cancel booking'); await expectText(custPage, /Cancel this booking\?/);
  await fill(custPage, 'Reason', 'Changed my plans'); await clickButton(custPage, 'Cancel booking'); await expectText(custPage, /Booking cancelled/); await expectText(custPage, /Cancelled/); await expectText(custPage, /Changed my plans/);
});
await run('notifications: unread badge, open one, mark all read', async () => {
  await go(custPage, '/customer/notifications'); await expectText(custPage, /unread/); await clickButton(custPage, 'Mark all as read'); await expectText(custPage, /You are all caught up/);
});
await run('unknown or foreign booking shows "not found"; wrong-role URL is blocked', async () => {
  await go(custPage, '/customer/bookings/999999'); await expectText(custPage, /Booking not found/);
  await go(techPage, '/customer'); await expectText(techPage, /do not have access/i);
  const other = await s.customerWithAddress('Other'); const ob = await s.book(other, leak.id); await go(custPage, `/customer/bookings/${ob.id}`); await expectText(custPage, /Booking not found/);
});

console.log('Technician flows');
await run('availability: add slot, overlap is rejected, save persists after reload', async () => {
  await go(techPage, '/technician/availability'); await clickButton(techPage, 'Add time slot'); await clickButton(techPage, 'Add time slot');
  await clickButton(techPage, 'Save availability'); await expectText(techPage, /must not overlap/i);
  await techPage.evaluate(() => { const sels = document.querySelectorAll('select[aria-label$="day"]'); const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }; set(sels[1], '2'); });
  await clickButton(techPage, 'Save availability'); await expectText(techPage, /Availability saved/);
  await go(techPage, '/technician/availability'); const n = await techPage.evaluate(() => document.querySelectorAll('.slot-row').length); if (n !== 2) throw new Error(`expected 2 saved slots, found ${n}`);
});
await run('professional profile saves', async () => { await go(techPage, '/technician/profile'); await fill(techPage, 'Years of experience', '9'); await clickButton(techPage, 'Save professional profile'); await expectText(techPage, /Professional profile saved/); const me = (await s.call('/technicians/me', { token: tech.token })).data; if (me.experienceYears !== 9) throw new Error('not persisted'); });
await run('additional work mid-job: revision needs a reason, pauses completion, customer re-approves, payable amount follows the new version', async () => {
  const b = await s.jobAt('IN_PROGRESS', { customer: cust, tech, serviceId: leak.id });
  await go(techPage, `/technician/jobs/${b.id}`); await clickButton(techPage, 'Additional work: revise quotation'); await expectText(techPage, /Revise quotation \(new version 2\)/);
  await clickButton(techPage, 'Send revised quotation'); await expectText(techPage, /Explain why the quotation is changing/);
  await fill(techPage, 'Reason for the revision', 'Found a corroded pipe section'); await clickButton(techPage, 'Add line item');
  await (await techPage.$('input[aria-label="Item 2 description"]')).type('Replacement pipe'); await (await techPage.$('input[aria-label="Item 2 unit price"]')).type('200.00'); await clickButton(techPage, 'Send revised quotation');
  await expectText(techPage, /Quotation version 2/); await expectText(techPage, /Quotation awaiting approval/); const t = await textOf(techPage); if (/Mark completed/.test(t)) throw new Error('completion offered while the new price is unapproved');
  await go(custPage, `/customer/bookings/${b.id}`); await expectText(custPage, /Your decision is needed/); await expectText(custPage, /700\.00/); await clickButton(custPage, 'Approve quotation'); await clickButton(custPage, 'Approve quotation'); await expectText(custPage, /Quotation approved/);
  await go(techPage, `/technician/jobs/${b.id}`); await clickButton(techPage, 'Start work'); await expectText(techPage, /Work in progress/); await clickButton(techPage, 'Mark completed'); await fill(techPage, 'Completion notes', 'Replaced the pipe and tested.'); await clickButton(techPage, 'Mark completed'); await expectText(techPage, /Job marked as completed/);
  await go(custPage, `/customer/bookings/${b.id}`); await expectText(custPage, /Amount due: ₹700\.00/);
});

console.log('Application review loop');
await run('needs-more-info loop: admin asks, applicant sends documents, admin rejects with a reason, applicant can re-apply', async () => {
  const t2 = await s.register('TECHNICIAN', 'Loop Applicant'); await s.submitApplication(t2.token, [leak.id], 'Loop Applicant'); const p = await h.newSession('loop'); await login(p, t2.email, 'Secret123');
  await go(adminPage, '/admin/applications?status=SUBMITTED'); await expectText(adminPage, /Loop Applicant/); await adminPage.evaluate(() => [...document.querySelectorAll('table a')].find((a) => /Loop Applicant/.test(a.textContent)).click());
  await expectText(adminPage, /Decision/); await clickButton(adminPage, 'Request more information'); await fill(adminPage, 'What do you need', 'Please add your trade certificate.'); await clickButton(adminPage, 'Send request'); await expectText(adminPage, /Waiting for the applicant/);
  await go(p, '/technician/application'); await expectText(p, /More information needed/); await expectText(p, /trade certificate/); await expectText(p, /Send the requested information/);
  await (await p.$('input[type=file]')).uploadFile(PDF); await clickButton(p, 'Send documents'); await expectText(p, /Under review/); await expectText(p, /Certificate/i);
  await go(adminPage, '/admin/applications?status=SUBMITTED'); await adminPage.evaluate(() => [...document.querySelectorAll('table a')].find((a) => /Loop Applicant/.test(a.textContent)).click());
  await expectText(adminPage, /Decision/); await clickButton(adminPage, 'Reject'); await fill(adminPage, 'Reason', 'Certificate is not legible.'); await clickButton(adminPage, 'Reject application'); await expectText(adminPage, /This application has been decided/);
  await go(p, '/technician/application'); await expectText(p, /Not approved/); await expectText(p, /not legible/); await expectText(p, /Submit application/);
  await go(p, '/technician/jobs/available'); await expectText(p, /Approval required/); await p.ctx.close();
});
await run('a deactivated technician sees "approval required" and cannot work', async () => {
  const t3 = await s.approvedTechnician(admin.token, [leak.id], 'Deactivated Tech'); const p = await h.newSession('deact'); await login(p, t3.email, 'Secret123');
  await go(p, '/technician/jobs/available'); await expectNoText(p, /Approval required/, 300);
  await s.call(`/technicians/${t3.profileId}/active`, { method: 'PATCH', token: admin.token, body: { isActive: false } }); await go(p, '/technician/jobs/available'); await expectText(p, /Approval required/);
  await go(p, '/technician'); await expectText(p, /deactivated/i); await p.ctx.close();
});

console.log('Administration');
await run('catalogue: create category and service, edit price, deactivate hides it from customers, reactivate', async () => {
  const nm = `UI Garden ${Date.now() % 100000}`, sv = `UI Lawn Care ${Date.now() % 100000}`;
  await go(adminPage, '/admin/categories'); await clickButton(adminPage, 'New category'); await fill(adminPage, 'Name', nm); await clickButton(adminPage, 'Save category'); await expectText(adminPage, new RegExp(nm));
  await go(adminPage, '/admin/services'); await clickButton(adminPage, 'New service'); await choose(adminPage, 'Category', nm); await fill(adminPage, 'Name', sv); await fill(adminPage, 'Indicative starting price', '150.00'); await clickButton(adminPage, 'Save service');
  await fill(adminPage, 'Search', sv); await expectText(adminPage, /150\.00/); await rowAction(adminPage, sv, 'Edit'); await fill(adminPage, 'Indicative starting price', '175.00'); await clickButton(adminPage, 'Save service'); await expectText(adminPage, /175\.00/);
  const pub = await h.newSession('pub'); await go(pub, `/services?q=${encodeURIComponent(sv)}`); await expectText(pub, new RegExp(sv));
  await rowAction(adminPage, sv, 'Deactivate'); await clickButton(adminPage, 'Deactivate'); await expectText(adminPage, /Service updated/); await go(pub, `/services?q=${encodeURIComponent(sv)}`); await expectText(pub, /No services match/);
  await go(adminPage, '/admin/services'); await fill(adminPage, 'Search', sv); await rowAction(adminPage, sv, 'Activate'); await clickButton(adminPage, 'Activate'); await expectText(adminPage, /Service updated/); await go(pub, `/services?q=${encodeURIComponent(sv)}`); await expectText(pub, new RegExp(sv)); await pub.ctx.close();
});
await run('users: admin disables an account; the person is locked out and cannot log in', async () => {
  const u = await s.register('CUSTOMER', 'Disable Me'); await go(adminPage, '/admin/users'); await fill(adminPage, 'Search', u.email); await expectText(adminPage, /Disable Me/);
  await rowAction(adminPage, u.email, 'Disable'); await clickButton(adminPage, 'Disable account'); await expectText(adminPage, /Account disabled/);
  try { await s.login(u.email, 'Secret123'); throw new Error('disabled user could log in'); } catch (e) { if (e.code !== 'ACCOUNT_DISABLED') throw e; }
  const me = await fetch(`${API}/auth/me`, { headers: { authorization: `Bearer ${u.token}` } }); if (me.status === 200) throw new Error('old token still works');
});
await run('bookings: admin assigns a technician, then cancels; customer sees both', async () => {
  const b = await s.book(cust, leak.id); await go(adminPage, `/admin/bookings/${b.id}`); await clickButton(adminPage, 'Assign a technician'); await choose(adminPage, 'Technician', 'Ext Technician'); await clickButton(adminPage, 'Assign technician'); await expectText(adminPage, /Technician assigned/);
  await clickButton(adminPage, 'Cancel booking'); await fill(adminPage, 'Reason', 'Duplicate request'); await clickButton(adminPage, 'Cancel booking'); await expectText(adminPage, /Booking cancelled/);
  await go(custPage, `/customer/bookings/${b.id}`); await expectText(custPage, /Cancelled/); await expectText(custPage, /Duplicate request/);
});
await run('reviews: admin hides a review (public list drops it) and shows it again', async () => {
  const b = await s.jobAt('PAID', { customer: cust, tech, serviceId: leak.id }); const marker = `Review marker ${Date.now() % 100000}`;
  await s.call('/reviews', { method: 'POST', token: cust.token, body: { bookingId: b.id, rating: 4, comment: marker } });
  const pubCount = async () => (await s.call(`/reviews?serviceId=${leak.id}&pageSize=100`)).data.filter((r) => r.comment === marker).length;
  await go(adminPage, '/admin/reviews'); await fill(adminPage, 'Search', marker); await expectText(adminPage, new RegExp(marker)); if ((await pubCount()) !== 1) throw new Error('review not public initially');
  await rowAction(adminPage, marker, 'Hide'); await expectText(adminPage, /Hide this review\?/); await clickButton(adminPage, 'Hide review'); await expectText(adminPage, /Review hidden/); if ((await pubCount()) !== 0) throw new Error('hidden review still public');
  await rowAction(adminPage, marker, 'Show'); await expectText(adminPage, /visible again/); if ((await pubCount()) !== 1) throw new Error('review not restored');
});
await run('reports: CSV download produces a real file with the right header', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixnow-dl-')); const cdp = await h.browser.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, browserContextId: adminPage.ctx.id });
  await go(adminPage, '/admin/reports'); await expectText(adminPage, /Booking volume by date and status/); await choose(adminPage, 'Report', 'Service and category demand'); await expectText(adminPage, /Service and category demand/);
  await clickButton(adminPage, 'Download CSV'); let file; for (let i = 0; i < 40 && !file; i++) { await sleep(250); file = fs.readdirSync(dir).find((f) => f.endsWith('.csv')); }
  if (!file) throw new Error('no CSV file was downloaded'); const csv = fs.readFileSync(path.join(dir, file), 'utf8'); if (!/^Category,Service,Bookings,Completed,Cancelled/.test(csv)) throw new Error(`unexpected CSV header: ${csv.slice(0, 80)}`); if (csv.split('\n').length < 3) throw new Error('CSV has no data rows');
});
await run('settings: invalid value is rejected by the server, valid value saves', async () => {
  await go(adminPage, '/admin/settings'); await fill(adminPage, 'Quotation validity', '500'); await clickButton(adminPage, 'Save settings'); await expectText(adminPage, /Invalid value for quotation_validity_days/);
  await go(adminPage, '/admin/settings'); await fill(adminPage, 'Quotation validity', '10'); await clickButton(adminPage, 'Save settings'); await expectText(adminPage, /Settings saved/);
  await go(adminPage, '/admin/settings'); await fill(adminPage, 'Quotation validity', '7'); await clickButton(adminPage, 'Save settings'); await expectText(adminPage, /Settings saved/);
});

console.log('Sessions and mobile');
await run('login returns the user to the page they originally asked for (regression: GuestRoute/Login redirect race)', async () => {
  const b = await s.book(cust, leak.id); const p = await h.newSession('return');
  await go(p, `/customer/bookings/${b.id}`); await p.waitForFunction(() => location.pathname === '/login', { timeout: 6000 });
  await fill(p, 'Email', cust.email); await fill(p, 'Password', cust.password); await clickButton(p, 'Log in');
  await p.waitForFunction((id) => location.pathname === `/customer/bookings/${id}`, { timeout: 8000 }, b.id); await expectText(p, /Booking FN-/);
  const other = await h.newSession('cross'); await go(other, '/admin/users'); await p.ctx.close(); await other.ctx.close();
});
await run('a customer who was sent to log in for an admin URL ends up on their own dashboard, never in /admin', async () => {
  const p = await h.newSession('cross2'); await go(p, '/admin/users'); await p.waitForFunction(() => location.pathname === '/login', { timeout: 6000 });
  await fill(p, 'Email', cust.email); await fill(p, 'Password', cust.password); await clickButton(p, 'Log in'); await p.waitForFunction(() => location.pathname === '/customer', { timeout: 8000 }); await p.ctx.close();
});
await run('a disabled account is signed out on its next action, with a clear message (token is revoked first, so the generic expiry text is shown)', async () => {
  const u = await s.customerWithAddress('Soon Disabled'); const p = await h.newSession('soon'); await login(p, u.email, 'Secret123'); await go(p, '/customer');
  await s.call(`/users/${u.user.id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'DISABLED' } });
  await clickLink(p, 'My bookings', '.sidebar'); await p.waitForFunction(() => location.pathname === '/login', { timeout: 8000 }); await expectText(p, /session has expired|account has been disabled/i); await p.ctx.close();
});
await run('a garbage session token is dropped and the visitor is sent to log in', async () => {
  const p = await h.newSession('garbage'); await go(p, '/'); await p.evaluate(() => sessionStorage.setItem('fixnow.session', 'not-a-real-token')); await go(p, '/customer/bookings');
  await p.waitForFunction(() => location.pathname === '/login', { timeout: 8000 }); const t = await p.evaluate(() => sessionStorage.getItem('fixnow.session')); if (t) throw new Error('bad token was kept'); await p.ctx.close();
});
await run('mobile: the dashboard menu opens, navigates and closes (390px, no horizontal scroll)', async () => {
  const c = await s.customerWithAddress('Mobile Customer'); const p = await h.newSession('mobile', { viewport: { width: 390, height: 844 } }); await login(p, c.email, 'Secret123'); await go(p, '/customer');
  const over = () => p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1); if (await over()) throw new Error('overflow on dashboard');
  await clickButton(p, 'Menu', { scope: 'header.topbar' }); await sleep(300); const open = await p.evaluate(() => document.querySelector('.shell').classList.contains('nav-open')); if (!open) throw new Error('menu did not open');
  await clickLink(p, 'My bookings', '.sidebar'); await p.waitForFunction(() => location.pathname === '/customer/bookings', { timeout: 6000 }); await sleep(300);
  const closed = await p.evaluate(() => !document.querySelector('.shell').classList.contains('nav-open')); if (!closed) throw new Error('menu stayed open after navigating');
  await go(p, '/customer/book'); if (await over()) throw new Error('overflow on booking form'); await h.shot(p, 'ext-mobile-book'); await p.ctx.close();
});

await h.finish();
