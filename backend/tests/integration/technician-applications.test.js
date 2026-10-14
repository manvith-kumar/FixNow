import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootApp, login, bearer, register, pdf, futureDate } from '../helpers.js';

let ctx, admin, customer, serviceId, addressId;
before(async () => {
  ctx = await bootApp();
  admin = await login(ctx.api, 'admin@fixnow.test');
  customer = await login(ctx.api, 'customer@fixnow.test');
  serviceId = (await ctx.api.get('/api/services?q=Leak')).body.data[0].id;
  addressId = (await ctx.api.get('/api/addresses').set(bearer(customer))).body.data[0].id;
});
after(async () => { await ctx.close(); });

const apply = (api, token, over = {}) => {
  let r = api.post('/api/technician-applications').set(bearer(token))
    .field('fullName', 'App Tech').field('phone', '+911234567890').field('specialization', 'Plumbing').field('experienceYears', '3')
    .field('serviceArea', 'Guntur').field('serviceIds', JSON.stringify([over.serviceId ?? serviceId])).field('docTypes', over.docTypes ?? 'ID_DOCUMENT');
  return over.noFile ? r : r.attach('documents', over.file ?? pdf(), { filename: over.filename ?? 'id.pdf', contentType: over.contentType ?? 'application/pdf' });
};
const createBooking = (token) => ctx.api.post('/api/bookings').set(bearer(token)).send({ serviceId, addressId, problemDescription: 'Kitchen tap is leaking badly', preferredDate: futureDate(), preferredTime: '10:00' });

test('unapproved technicians (no application / pending / rejected) cannot accept jobs - enforced by the API', async () => {
  const b = (await createBooking(customer)).body.data;
  const fresh = await register(ctx.api, 'TECHNICIAN');
  let r = await ctx.api.post(`/api/bookings/${b.id}/accept`).set(bearer(fresh.token));
  assert.equal(r.status, 403); assert.equal(r.body.error.code, 'TECHNICIAN_NOT_APPROVED');
  assert.equal((await ctx.api.get('/api/bookings/available').set(bearer(fresh.token))).status, 403);

  const app = await apply(ctx.api, fresh.token);
  assert.equal(app.status, 201, JSON.stringify(app.body));
  r = await ctx.api.post(`/api/bookings/${b.id}/accept`).set(bearer(fresh.token));
  assert.equal(r.status, 403, 'pending application must not accept jobs');

  const rej = await ctx.api.post(`/api/technician-applications/${app.body.data.id}/decision`).set(bearer(admin)).send({ decision: 'REJECT', notes: 'Documents unclear' });
  assert.equal(rej.status, 200);
  r = await ctx.api.post(`/api/bookings/${b.id}/accept`).set(bearer(fresh.token));
  assert.equal(r.status, 403, 'rejected technician must not accept jobs');
  const mine = await ctx.api.get('/api/technician-applications/mine').set(bearer(fresh.token));
  assert.equal(mine.body.data.current.status, 'REJECTED');
  assert.equal(mine.body.data.current.reviewNotes, 'Documents unclear');
  const notes = await ctx.api.get('/api/notifications').set(bearer(fresh.token));
  assert.ok(notes.body.data.some((n) => n.type === 'APPLICATION_REJECTED'));
});

test('application validation: missing document, missing ID doc, bad file types and fake content are rejected', async () => {
  const t = await register(ctx.api, 'TECHNICIAN');
  assert.equal((await apply(ctx.api, t.token, { noFile: true })).status, 400);
  assert.equal((await apply(ctx.api, t.token, { docTypes: 'CERTIFICATE' })).status, 400);
  assert.equal((await apply(ctx.api, t.token, { file: Buffer.from('MZ\x90\x00 exe'), filename: 'run.exe', contentType: 'application/x-msdownload' })).status, 400);
  const fake = await apply(ctx.api, t.token, { file: Buffer.from('<?php echo 1; ?>'), filename: 'evil.pdf', contentType: 'application/pdf' });
  assert.equal(fake.status, 400, 'content that is not really a PDF must be rejected');
  assert.equal((await apply(ctx.api, t.token, { serviceId: 999999 })).status, 400);
  // a status or role can never be client-supplied
  const r = await ctx.api.post('/api/technician-applications').set(bearer(t.token)).field('status', 'APPROVED').attach('documents', pdf(), { filename: 'a.pdf', contentType: 'application/pdf' });
  assert.equal(r.status, 400);
});

test('approval, protected documents, duplicate application guard and persisted state', async () => {
  const t = await register(ctx.api, 'TECHNICIAN');
  const other = await register(ctx.api, 'TECHNICIAN');
  const app = await apply(ctx.api, t.token);
  assert.equal(app.status, 201);
  const id = app.body.data.id, docId = app.body.data.documents[0].id;
  assert.equal((await apply(ctx.api, t.token)).status, 409, 'second open application rejected');
  assert.equal(app.body.data.documents[0].storedName, undefined, 'stored file name is never exposed');

  // documents are protected
  const dl = `/api/technician-applications/${id}/documents/${docId}/download`;
  assert.equal((await ctx.api.get(dl)).status, 401);
  assert.equal((await ctx.api.get(dl).set(bearer(customer))).status, 403);
  assert.equal((await ctx.api.get(dl).set(bearer(other.token))).status, 404, "another technician cannot download someone else's document");
  const ok = await ctx.api.get(dl).set(bearer(admin));
  assert.equal(ok.status, 200); assert.equal(ok.headers['content-type'], 'application/pdf'); assert.equal(ok.headers['x-content-type-options'], 'nosniff');
  assert.equal((await ctx.api.get(dl).set(bearer(t.token))).status, 200, 'owner can download their own document');

  // only admin can decide; technician cannot approve themselves
  assert.equal((await ctx.api.post(`/api/technician-applications/${id}/decision`).set(bearer(t.token)).send({ decision: 'APPROVE' })).status, 403);
  // reject requires notes
  assert.equal((await ctx.api.post(`/api/technician-applications/${id}/decision`).set(bearer(admin)).send({ decision: 'REJECT' })).status, 400);
  // request more info -> technician adds a document -> back to SUBMITTED
  assert.equal((await ctx.api.post(`/api/technician-applications/${id}/decision`).set(bearer(admin)).send({ decision: 'REQUEST_INFO', notes: 'Please add a certificate' })).status, 200);
  const prof = await ctx.api.get('/api/technicians/me').set(bearer(t.token));
  assert.equal(prof.body.data.approvalStatus, 'NEEDS_INFO');
  const add = await ctx.api.post(`/api/technician-applications/${id}/documents`).set(bearer(t.token)).field('docTypes', 'CERTIFICATE').attach('documents', pdf(), { filename: 'cert.pdf', contentType: 'application/pdf' });
  assert.equal(add.status, 200); assert.equal(add.body.data.status, 'SUBMITTED'); assert.equal(add.body.data.documents.length, 2);

  const approve = await ctx.api.post(`/api/technician-applications/${id}/decision`).set(bearer(admin)).send({ decision: 'APPROVE' });
  assert.equal(approve.status, 200); assert.equal(approve.body.data.status, 'APPROVED');
  const after = await ctx.api.get('/api/technicians/me').set(bearer(t.token));
  assert.equal(after.body.data.approvalStatus, 'APPROVED');
  assert.equal(after.body.data.services.length, 1);
  assert.equal((await ctx.api.post(`/api/technician-applications/${id}/decision`).set(bearer(admin)).send({ decision: 'REJECT', notes: 'too late now' })).status, 409, 'cannot re-decide');

  // stored files live only in the upload dir with random names
  const files = fs.readdirSync(process.env.UPLOAD_DIR).filter((f) => !f.startsWith('.'));
  assert.ok(files.length >= 2 && files.every((f) => /^[0-9a-f-]{36}\.(pdf|jpg|png)$/.test(f)), files.join(','));
});

test('approved technician can see eligible jobs with limited customer details', async () => {
  const t = await register(ctx.api, 'TECHNICIAN');
  const app = await apply(ctx.api, t.token);
  await ctx.api.post(`/api/technician-applications/${app.body.data.id}/decision`).set(bearer(admin)).send({ decision: 'APPROVE' });
  const b = (await createBooking(customer)).body.data;
  const list = await ctx.api.get('/api/bookings/available').set(bearer(t.token));
  assert.equal(list.status, 200);
  const job = list.body.data.find((j) => j.id === b.id);
  assert.ok(job);
  assert.equal(job.address.line1, undefined, 'full street address hidden before acceptance');
  assert.equal(job.customer, undefined, 'customer contact hidden before acceptance');
});
