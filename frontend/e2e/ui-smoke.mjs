// Real-browser smoke test of the whole FixNow workflow through the UI (customer -> technician -> admin).
// Requires: backend running with seed data (start it with AUTH_RATE_LIMIT_MAX=1000 so repeated runs are not rate limited),
// the built frontend served (npm run build && npm run preview) and a Chrome/Chromium binary.
//   CHROME_PATH=... APP_URL=http://localhost:4173 API_URL=http://localhost:5055/api node e2e/ui-smoke.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHarness } from './helpers.mjs';

const APP = process.env.APP_URL ?? 'http://localhost:4173';
const API = process.env.API_URL ?? 'http://localhost:5055/api';
const PDF = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sample-id.pdf');
const h = await createHarness({ app: APP, api: API, chrome: process.env.CHROME_PATH, shots: process.env.SHOTS_DIR ?? path.join(process.cwd(), 'e2e', 'screenshots') });
const { step, go, fill, fillSelector, expectText, clickButton, login, textOf, shot, newSession } = h;
const stamp = Date.now();

let customer, tech, admin, reference;
try {
  console.log('Public pages');
  const pub = await newSession('public');
  await step('home page renders the hero and loads categories from the API', async () => { await go(pub, '/'); await expectText(pub, /Repairs you approve before they start/); await expectText(pub, /Plumbing/); await shot(pub, '01-home-desktop'); });
  await step('home page is usable on a 390px phone with no horizontal scroll', async () => {
    await pub.setViewport({ width: 390, height: 844 }); await go(pub, '/');
    const over = await pub.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1); if (over) throw new Error('horizontal overflow at 390px');
    await shot(pub, '02-home-mobile'); await pub.setViewport({ width: 1280, height: 900 });
  });
  await step('services page lists, searches and links to details', async () => {
    await go(pub, '/services'); await expectText(pub, /Browse services/); await expectText(pub, /Leak Repair/);
    await fill(pub, 'Search', 'washing'); await expectText(pub, /Washing Machine Repair/); const t = await textOf(pub); if (/Leak Repair/.test(t)) throw new Error('search did not filter');
    await go(pub, '/services?q=Leak'); await pub.evaluate(() => [...document.querySelectorAll('h3 a')].find((a) => /Leak Repair/.test(a.textContent)).click());
    await expectText(pub, /Indicative starting price/); await expectText(pub, /What happens after you book/);
  });
  await step('static pages and 404 render', async () => { for (const [p, re] of [['/how-it-works', /How FixNow works/], ['/about', /About FixNow/], ['/privacy', /Privacy policy/], ['/terms', /Terms and conditions/], ['/contact', /Contact/], ['/nope-nope', /could not find that page/]]) { await go(pub, p); await expectText(pub, re, 4000); } });
  await step('protected areas redirect anonymous visitors to login', async () => { await go(pub, '/customer/bookings'); await expectText(pub, /Log in/); if (!pub.url().endsWith('/login')) throw new Error(`url ${pub.url()}`); });

  console.log('Customer registration and booking');
  customer = await newSession('customer');
  await step('customer registers through the form (validation shown, then success)', async () => {
    await go(customer, '/register'); await clickButton(customer, 'Create account'); await expectText(customer, /Enter your full name/);
    await fill(customer, 'Full name', 'Ui Customer'); await fill(customer, 'Email', `ui.c.${stamp}@t.dev`); await fill(customer, 'Password', 'Secret123'); await fill(customer, 'Confirm password', 'Secret123');
    await customer.evaluate(() => document.querySelector('input[type=checkbox]').click()); await clickButton(customer, 'Create account');
    await customer.waitForFunction(() => location.pathname === '/customer', { timeout: 8000 }); await expectText(customer, /Hello, Ui/);
  });
  await step('customer adds an address', async () => { await go(customer, '/customer/addresses'); await clickButton(customer, 'Add address'); await fill(customer, 'Address line 1', '7 Test Lane'); await fill(customer, 'City', 'Guntur'); await clickButton(customer, 'Save address'); await expectText(customer, /7 Test Lane/); });
  await step('customer books Leak Repair (price disclaimer visible, geolocation optional)', async () => {
    await go(customer, '/services?q=Leak'); await clickButton(customer, 'Book this service'); await customer.waitForFunction(() => location.pathname === '/customer/book', { timeout: 6000 });
    await expectText(customer, /Indicative starting price/); await shot(customer, '03-book-form');
    await clickButton(customer, 'Book inspection'); await expectText(customer, /Describe the problem in at least 10 characters/);
    await fill(customer, 'Describe the problem', 'The kitchen tap leaks constantly at the base.'); await clickButton(customer, 'Book inspection');
    await customer.waitForFunction(() => /^\/customer\/bookings\/\d+/.test(location.pathname), { timeout: 8000 });
    const t = await expectText(customer, /FN-\d{8}-[A-Z2-9]{6}/); reference = t.match(/FN-\d{8}-[A-Z2-9]{6}/)[0]; await expectText(customer, /Waiting for a technician/);
  });

  console.log('Technician application and admin approval');
  tech = await newSession('technician'); admin = await newSession('admin');
  await step('technician registers and submits an application with a document', async () => {
    await go(tech, '/register?role=TECHNICIAN'); await fill(tech, 'Full name', 'Ui Technician'); await fill(tech, 'Email', `ui.t.${stamp}@t.dev`); await fill(tech, 'Password', 'Secret123'); await fill(tech, 'Confirm password', 'Secret123');
    await tech.evaluate(() => document.querySelector('input[type=checkbox]').click()); await clickButton(tech, 'Create account');
    await tech.waitForFunction(() => location.pathname === '/technician/application', { timeout: 8000 }); await expectText(tech, /Professional details/);
    await clickButton(tech, 'Submit application'); await expectText(tech, /Select at least one service/);
    await fill(tech, 'Full name', 'Ui Technician'); await fill(tech, 'Phone', '+911234567890'); await fill(tech, 'Specialization', 'Plumbing'); await fill(tech, 'Years of experience', '5'); await fill(tech, 'Service area', 'Guntur');
    await tech.evaluate(() => [...document.querySelectorAll('label.check')].find((l) => l.textContent.trim() === 'Leak Repair').querySelector('input').click());
    const fileInput = await tech.$('input[type=file]'); await fileInput.uploadFile(PDF);
    await clickButton(tech, 'Submit application'); await expectText(tech, /Under review/); await shot(tech, '04-application-status');
  });
  await step('an unapproved technician cannot see jobs (clear message, no accept possible)', async () => { await go(tech, '/technician/jobs/available'); await expectText(tech, /Approval required/); });
  await step('admin logs in, reviews the application (document downloads) and approves it', async () => {
    await login(admin, 'admin@fixnow.test'); await expectText(admin, /Dashboard/);
    await go(admin, '/admin/applications?status=SUBMITTED'); await expectText(admin, /Ui Technician/);
    await admin.evaluate(() => [...document.querySelectorAll('table a')].find((a) => /Ui Technician/.test(a.textContent)).click());
    await expectText(admin, /Documents/); await expectText(admin, /Id document/i);
    await clickButton(admin, 'Approve'); await expectText(admin, /Approve Ui Technician\?/); await clickButton(admin, 'Approve technician'); await expectText(admin, /This application has been decided/);
  });

  console.log('Inspection, quotation, approval, completion');
  await step('approved technician sees the job and accepts it', async () => {
    await go(tech, '/technician/jobs/available'); await expectText(tech, new RegExp('Leak Repair'));
    const t = await textOf(tech); if (/7 Test Lane/.test(t)) throw new Error('customer street address leaked before acceptance');
    await expectText(tech, new RegExp(reference));
    const accept = (await tech.evaluateHandle((ref) => { const tr = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes(ref)); return tr ? [...tr.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Accept job') ?? null : null; }, reference)).asElement();
    if (!accept) throw new Error('own booking not listed among available jobs'); await accept.click();
    await expectText(tech, /Accept this job\?/); await clickButton(tech, 'Accept job');
    await tech.waitForFunction(() => /^\/technician\/jobs\/\d+/.test(location.pathname), { timeout: 8000 }); await expectText(tech, /7 Test Lane/);
  });
  await step('technician starts inspection and records findings', async () => {
    await clickButton(tech, 'Start inspection'); await expectText(tech, /Inspection in progress/); await clickButton(tech, 'Record findings');
    await fill(tech, 'Diagnosis', 'Worn tap washer'); await fill(tech, 'Observed condition', 'Steady drip from the spout'); await clickButton(tech, 'Save inspection'); await expectText(tech, /Inspection done, quote coming/);
  });
  await step('technician sends an itemized quotation (totals come from the server)', async () => {
    await clickButton(tech, 'Create quotation'); await expectText(tech, /Line items/);
    const d = await tech.$('input[aria-label="Item 1 description"]'); await d.type('Repair labour'); const p = await tech.$('input[aria-label="Item 1 unit price"]'); await p.type('450.00');
    await clickButton(tech, 'Add line item'); const d2 = await tech.$('input[aria-label="Item 2 description"]'); await d2.type('Washer set'); await fillSelector(tech, 'input[aria-label="Item 2 quantity"]', '2'); const p2 = await tech.$('input[aria-label="Item 2 unit price"]'); await p2.type('75.50');
    await fill(tech, 'Tax rate', '18'); await clickButton(tech, 'Send quotation');
    await expectText(tech, /Quotation version 1/); await expectText(tech, /601\.00/); /* 450 + 2x75.50 = 601.00 subtotal */ await expectText(tech, /709\.18/); await shot(tech, '05-technician-quote');
  });
  await step('customer rejects v1 with a reason; technician revises; customer sees both versions', async () => {
    await go(customer, '/customer/bookings'); await customer.evaluate((r) => [...document.querySelectorAll('table a')].find((a) => a.textContent === r).click(), reference);
    await expectText(customer, /Your decision is needed/); await clickButton(customer, 'Reject quotation'); await clickButton(customer, 'Reject quotation', { exact: true }).catch(() => {});
    await expectText(customer, /Reason/);
    await fill(customer, 'Reason', 'Labour price is too high'); await customer.evaluate(() => [...document.querySelectorAll('.modal button[type=submit]')][0].click()); await expectText(customer, /Quotation rejected|rejected/i);
    await go(tech, tech.url().replace(APP, '')); await expectText(tech, /customer rejected the quotation/i); await clickButton(tech, 'Send revised quotation');
    await expectText(tech, /Reason for the revision/); await fillSelector(tech, 'input[aria-label="Item 1 unit price"]', '400.00'); await clickButton(tech, 'Send revised quotation', { exact: true });
    await expectText(tech, /Quotation version 2/); await go(customer, customer.url().replace(APP, '')); await expectText(customer, /Quotation version 2/); await expectText(customer, /Earlier versions/);
  });
  await step('customer approves the current quotation through the confirmation dialog', async () => {
    await clickButton(customer, 'Approve quotation'); await expectText(customer, /Approve this quotation\?/); await expectText(customer, /version 2/);
    await customer.evaluate(() => [...document.querySelectorAll('.modal button')].find((b) => b.textContent.trim() === 'Approve quotation').click());
    await expectText(customer, /Quotation approved/); await shot(customer, '06-customer-approved');
  });
  await step('technician starts work and completes the job', async () => {
    await go(tech, tech.url().replace(APP, '')); await clickButton(tech, 'Start work'); await expectText(tech, /Work in progress/);
    await clickButton(tech, 'Mark completed'); await fill(tech, 'Completion notes', 'Replaced the washer and tested the tap.'); await customer.bringToFront(); await tech.bringToFront();
    await tech.evaluate(() => [...document.querySelectorAll('.modal button[type=submit]')][0].click()); await expectText(tech, /Completed/);
  });

  console.log('Simulated payment and review');
  await step('customer sees the simulated-payment banner, a declined attempt stays unpaid, then pays', async () => {
    await go(customer, customer.url().replace(APP, '')); await expectText(customer, /no real money is charged/i);
    await customer.evaluate(() => [...document.querySelectorAll('label.pick')].find((l) => /fails/.test(l.textContent)).querySelector('input').click());
    await clickButton(customer, 'Pay', { exact: false }); await expectText(customer, /Simulated payment declined/); await shot(customer, '07-payment-declined');
    await customer.evaluate(() => [...document.querySelectorAll('label.pick')].find((l) => /Demo card$/.test(l.textContent.split('Always')[0].trim()) || /^Demo card/.test(l.textContent.trim()) && !/fails/.test(l.textContent)).querySelector('input').click());
    await clickButton(customer, 'Pay', { exact: false }); await expectText(customer, /Payment received \(simulated\)/); await expectText(customer, /SIM-/); await shot(customer, '08-receipt');
  });
  await step('customer leaves a review; it is required before success is shown', async () => {
    await clickButton(customer, 'Submit review'); await expectText(customer, /Choose a star rating/);
    await customer.evaluate(() => document.querySelector('.star-input button[aria-label="5 stars"]').click());
    await fill(customer, 'Comment', 'Quick, tidy and fair price.'); await clickButton(customer, 'Submit review');
    await expectText(customer, /your review has been submitted/i);
  });
  await step('payment history and notifications show the real records', async () => {
    await go(customer, '/customer/payments'); await expectText(customer, /Paid \(simulated\)/); await expectText(customer, /Declined \(simulated\)/);
    await go(customer, '/customer/notifications'); await expectText(customer, /Payment received \(simulated\)/);
    await go(customer, '/customer/reviews'); await expectText(customer, /Quick, tidy and fair price/);
  });
  await step('technician earnings and reviews update', async () => { await go(tech, '/technician/earnings'); await expectText(tech, /SIMULATED/); await expectText(tech, /SIM-/); await go(tech, '/technician/reviews'); await expectText(tech, /Quick, tidy/); });

  console.log('Administration');
  await step('admin dashboard, bookings, quotations, payments, reviews, reports and settings load real data', async () => {
    await go(admin, '/admin'); await expectText(admin, /Simulated payments collected/); await shot(admin, '09-admin-dashboard');
    await go(admin, '/admin/bookings'); await expectText(admin, new RegExp(reference));
    await go(admin, '/admin/quotations'); await expectText(admin, /v2 \(current\)/);
    await go(admin, '/admin/payments'); await expectText(admin, /Paid \(simulated\)/);
    await go(admin, '/admin/reviews'); await expectText(admin, /Quick, tidy/);
    await go(admin, '/admin/reports'); await expectText(admin, /Booking volume by date and status/); await shot(admin, '10-admin-reports');
    await go(admin, '/admin/settings'); await expectText(admin, /Platform name/); await go(admin, '/admin/audit-logs'); await expectText(admin, /Application approve/i);
    await go(admin, '/admin/users'); await expectText(admin, /Ui Customer/); await go(admin, '/admin/categories'); await expectText(admin, /Plumbing/); await go(admin, '/admin/services'); await expectText(admin, /Leak Repair/);
  });
  await step('wrong-role access is blocked in the UI and the API', async () => {
    await go(customer, '/admin'); await expectText(customer, /do not have access/i);
    const status = await customer.evaluate(async (api) => { const t = sessionStorage.getItem('fixnow.session'); const r = await fetch(`${api}/admin/dashboard`, { headers: { Authorization: `Bearer ${t}` } }); return r.status; }, API); if (status !== 403) throw new Error(`API returned ${status}`);
  });
  await step('logout ends the session; the old token no longer works', async () => {
    const tok = await customer.evaluate(() => sessionStorage.getItem('fixnow.session'));
    await go(customer, '/customer'); await clickButton(customer, 'Log out', { scope: 'aside' }); await customer.waitForFunction(() => location.pathname === '/', { timeout: 6000 });
    const st = await customer.evaluate(async (t, api) => (await fetch(`${api}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })).status, tok, API); if (st !== 401) throw new Error(`old token still valid (${st})`);
  });
} catch (e) { console.log('\nStopped at first failure.'); }
await h.finish();
