import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, login, bearer, register, SEED_PASSWORD } from '../helpers.js';

let ctx;
before(async () => { ctx = await bootApp(); });
after(async () => { await ctx.close(); });

test('registration creates a hashed password and never returns it', async () => {
  const { api, pool } = ctx;
  const res = await api.post('/api/auth/register').send({ email: 'A@Test.dev', password: 'Secret123', fullName: 'Alice Doe' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.email, 'a@test.dev');
  assert.ok(!JSON.stringify(res.body).includes('password'));
  const [[row]] = await pool.query('SELECT password_hash FROM users WHERE email = ?', ['a@test.dev']);
  assert.match(row.password_hash, /^\$2[aby]\$/);
});
test('duplicate email is rejected with 409', async () => {
  const res = await ctx.api.post('/api/auth/register').send({ email: 'a@test.dev', password: 'Secret123', fullName: 'Alice Two' });
  assert.equal(res.status, 409);
});
test('weak passwords and invalid input are rejected with field details', async () => {
  const res = await ctx.api.post('/api/auth/register').send({ email: 'bad', password: 'short', fullName: 'A' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(res.body.error.details.length >= 2);
});
test('a client can NEVER self-register as ADMIN (or send extra fields)', async () => {
  const r1 = await ctx.api.post('/api/auth/register').send({ email: 'evil@test.dev', password: 'Secret123', fullName: 'Evil Admin', role: 'ADMIN' });
  assert.equal(r1.status, 400);
  const r2 = await ctx.api.post('/api/auth/register').send({ email: 'evil2@test.dev', password: 'Secret123', fullName: 'Evil Two', status: 'ACTIVE', isAdmin: true });
  assert.equal(r2.status, 400);
});
test('login works, wrong password and unknown email give the same generic error', async () => {
  const ok = await ctx.api.post('/api/auth/login').send({ email: 'a@test.dev', password: 'Secret123' });
  assert.equal(ok.status, 200); assert.ok(ok.body.data.token);
  const bad = await ctx.api.post('/api/auth/login').send({ email: 'a@test.dev', password: 'Wrong1234' });
  const unknown = await ctx.api.post('/api/auth/login').send({ email: 'nobody@test.dev', password: 'Wrong1234' });
  assert.equal(bad.status, 401); assert.equal(unknown.status, 401);
  assert.equal(bad.body.error.message, unknown.body.error.message);
});
test('protected endpoints need a valid token; garbage and tampered tokens are 401', async () => {
  assert.equal((await ctx.api.get('/api/auth/me')).status, 401);
  assert.equal((await ctx.api.get('/api/auth/me').set(bearer('garbage'))).status, 401);
  const { token } = await register(ctx.api);
  const tampered = token.slice(0, -3) + (token.endsWith('aaa') ? 'bbb' : 'aaa');
  assert.equal((await ctx.api.get('/api/auth/me').set(bearer(tampered))).status, 401);
  assert.equal((await ctx.api.get('/api/auth/me').set(bearer(token))).status, 200);
});
test('logout revokes the token server-side', async () => {
  const { token } = await register(ctx.api);
  assert.equal((await ctx.api.post('/api/auth/logout').set(bearer(token))).status, 200);
  const res = await ctx.api.get('/api/auth/me').set(bearer(token));
  assert.equal(res.status, 401);
});
test('disabled accounts cannot log in and existing tokens stop working', async () => {
  const admin = await login(ctx.api, 'admin@fixnow.test');
  const victim = await register(ctx.api);
  const res = await ctx.api.patch(`/api/users/${victim.user.id}/status`).set(bearer(admin)).send({ status: 'DISABLED' });
  assert.equal(res.status, 200);
  assert.equal((await ctx.api.get('/api/auth/me').set(bearer(victim.token))).status, 401);
  const l = await ctx.api.post('/api/auth/login').send({ email: victim.email, password: 'Secret123' });
  assert.equal(l.status, 403); assert.equal(l.body.error.code, 'ACCOUNT_DISABLED');
});
test('admin cannot disable their own account', async () => {
  const admin = await login(ctx.api, 'admin@fixnow.test');
  const me = await ctx.api.get('/api/auth/me').set(bearer(admin));
  const res = await ctx.api.patch(`/api/users/${me.body.data.user.id}/status`).set(bearer(admin)).send({ status: 'DISABLED' });
  assert.equal(res.status, 409);
});
test('role-based access: customers and technicians cannot use admin endpoints', async () => {
  const c = await register(ctx.api, 'CUSTOMER');
  const t = await register(ctx.api, 'TECHNICIAN');
  for (const tok of [c.token, t.token]) {
    assert.equal((await ctx.api.get('/api/admin/dashboard').set(bearer(tok))).status, 403);
    assert.equal((await ctx.api.get('/api/users').set(bearer(tok))).status, 403);
    assert.equal((await ctx.api.post('/api/categories').set(bearer(tok)).send({ name: 'Hack' })).status, 403);
  }
});
test('password reset: generic response, single use, old tokens revoked, new password works', async () => {
  const u = await register(ctx.api);
  const unknown = await ctx.api.post('/api/auth/forgot-password').send({ email: 'ghost@test.dev' });
  const known = await ctx.api.post('/api/auth/forgot-password').send({ email: u.email });
  assert.equal(unknown.status, 200); assert.equal(known.status, 200);
  assert.equal(unknown.body.data.message, known.body.data.message);
  assert.equal(unknown.body.data.devResetToken, undefined); // no token for unknown emails
  const token = known.body.data.devResetToken;
  assert.ok(token, 'dev mode exposes token only when DEV_EXPOSE_RESET_TOKEN=true and not production');
  const r = await ctx.api.post('/api/auth/reset-password').send({ token, password: 'NewSecret456' });
  assert.equal(r.status, 200);
  assert.equal((await ctx.api.post('/api/auth/reset-password').send({ token, password: 'Another789' })).status, 400); // single use
  assert.equal((await ctx.api.get('/api/auth/me').set(bearer(u.token))).status, 401); // old session revoked
  assert.equal((await ctx.api.post('/api/auth/login').send({ email: u.email, password: 'NewSecret456' })).status, 200);
});
test('seeded accounts can log in', async () => {
  for (const e of ['admin@fixnow.test', 'customer@fixnow.test', 'tech@fixnow.test']) assert.ok(await login(ctx.api, e, SEED_PASSWORD));
});
test('unknown API routes return JSON 404 and malformed JSON returns 400 (no stack traces)', async () => {
  const a = await ctx.api.get('/api/does-not-exist');
  assert.equal(a.status, 404); assert.equal(a.body.success, false);
  const b = await ctx.api.post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
  assert.equal(b.status, 400); assert.ok(!JSON.stringify(b.body).includes('at '));
});
