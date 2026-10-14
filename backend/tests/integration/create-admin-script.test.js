import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootApp, login } from '../helpers.js';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/create-admin.js');
let ctx;
before(async () => { ctx = await bootApp(); });
after(async () => { await ctx.close(); });
const run = (args, env = {}) => spawnSync(process.execPath, [script, ...args], { env: { ...process.env, ...env }, encoding: 'utf8' });

test('create-admin creates an ADMIN who can log in and use admin endpoints; the action is audited', async () => {
  const r = run(['--email', 'Owner@Example.com', '--name', 'Site Owner'], { ADMIN_PASSWORD: 'CorrectHorse2024' });
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /created/);
  const token = await login(ctx.api, 'owner@example.com', 'CorrectHorse2024');
  assert.equal((await ctx.api.get('/api/admin/dashboard').set({ Authorization: `Bearer ${token}` })).status, 200);
  const [[row]] = await ctx.pool.query("SELECT COUNT(*) c FROM audit_logs WHERE action = 'ADMIN_CREATED_BY_SCRIPT'"); assert.equal(row.c, 1);
});
test('create-admin refuses to touch an existing account (no silent password reset)', () => {
  const r = run(['--email', 'owner@example.com', '--name', 'Someone Else'], { ADMIN_PASSWORD: 'AnotherPass2024' });
  assert.equal(r.status, 1); assert.match(r.stderr, /already exists/);
  const r2 = run(['--email', 'customer@fixnow.test', '--name', 'Hijack Attempt'], { ADMIN_PASSWORD: 'AnotherPass2024' });
  assert.equal(r2.status, 1, 'must not promote or modify an existing customer');
});
test('create-admin rejects weak passwords, passwords on the command line, and missing input', () => {
  assert.equal(run(['--email', 'a1@example.com', '--name', 'Weak Pass'], { ADMIN_PASSWORD: 'short1' }).status, 1);
  assert.equal(run(['--email', 'a2@example.com', '--name', 'No Digits'], { ADMIN_PASSWORD: 'onlylettersnodigits' }).status, 1);
  const cli = run(['--email', 'a3@example.com', '--name', 'Cli Pass', '--password', 'CorrectHorse2024']); assert.equal(cli.status, 1); assert.match(cli.stderr, /Do not pass the password/);
  assert.equal(run(['--name', 'No Email'], { ADMIN_PASSWORD: 'CorrectHorse2024' }).status, 1);
  assert.equal(run(['--email', 'a4@example.com', '--name', 'No Tty'], { ADMIN_PASSWORD: '' }).status, 1, 'without a terminal or ADMIN_PASSWORD it must fail, not hang');
});
