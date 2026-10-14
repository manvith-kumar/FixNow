// Creates the FIRST administrator (or an additional one) in any environment, including production, where the seed is refused.
//   npm run admin:create -- --email owner@example.com --name "Site Owner"
// The password is read from a hidden prompt (interactive) or from the ADMIN_PASSWORD environment variable (automation).
// It is never accepted as a command-line argument (those end up in shell history and process lists).
import bcrypt from 'bcryptjs';
import { adminConnection, env } from './_cli.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]?.startsWith('--') ? 'true' : arr[i + 1]]] : acc), []));
const fail = (msg) => { console.error(`\n${msg}\n`); process.exit(1); };
if (args.password) fail('Do not pass the password as an argument. Use the hidden prompt or the ADMIN_PASSWORD environment variable.');
const email = String(args.email ?? '').trim().toLowerCase(); const name = String(args.name ?? '').trim();
if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 190) fail('Provide a valid --email.');
if (name.length < 2 || name.length > 120) fail('Provide --name (2 to 120 characters).');

function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const { stdin } = process; let value = '';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\u0003') { process.stdout.write('\n'); process.exit(130); }
        if (c === '\r' || c === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData); process.stdout.write('\n'); return resolve(value); }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1); else value += c;
      }
    };
    stdin.on('data', onData);
  });
}
let password = process.env.ADMIN_PASSWORD;
if (!password) {
  if (!process.stdin.isTTY) fail('No terminal available: set the ADMIN_PASSWORD environment variable for this run.');
  password = await promptHidden('Password for the new administrator: ');
  if (password !== await promptHidden('Repeat the password: ')) fail('The passwords do not match.');
}
if (password.length < 12 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) fail('Administrator passwords must be 12 to 72 characters and contain a letter and a digit.');

const conn = await adminConnection(true);
try {
  const [[existing]] = await conn.query('SELECT id, role FROM users WHERE email = ?', [email]);
  if (existing) fail(`An account with ${email} already exists (role ${existing.role}). Nothing was changed.`);
  const hash = await bcrypt.hash(password, Math.max(env.BCRYPT_ROUNDS, 10));
  await conn.query("INSERT INTO users (email, password_hash, full_name, role, status) VALUES (?,?,?, 'ADMIN', 'ACTIVE')", [email, hash, name]);
  await conn.query("INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, details) VALUES (NULL, NULL, 'ADMIN_CREATED_BY_SCRIPT', 'user', JSON_OBJECT('email', ?))", [email]);
  console.log(`Administrator ${email} created in database "${env.DB_NAME}".`);
} finally { await conn.end(); }
