// STATIC CONTRACT: every endpoint the frontend calls must exist in the backend's real Express route table
// (same method, same path shape). Catches typos and invented endpoints without needing a database.
process.env.DB_NAME ??= 'x_test'; process.env.DB_USER ??= 'x'; process.env.JWT_SECRET ??= 'x'.repeat(40);
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(here, '../../../frontend/src/api');
const { createApp } = await import('../../src/app.js');

// --- enumerate the backend route table (Express 4) ---
function layerPath(layer) {
  if (layer.regexp?.fast_slash) return '';
  const m = layer.regexp.toString().replace('\\/?', '').replace('(?=\\/|$)', '$').match(/^\/\^((?:\\[.*+?^${}()|[\]\\/]|[^.*+?^${}()|[\]\\/])*)\$\//);
  return m ? m[1].replace(/\\(.)/g, '$1') : '';
}
function collect(stack, prefix = '', out = []) {
  for (const layer of stack) {
    if (layer.route) for (const method of Object.keys(layer.route.methods)) out.push({ method: method.toUpperCase(), path: prefix + layer.route.path });
    else if (layer.name === 'router' && layer.handle.stack) collect(layer.handle.stack, prefix + layerPath(layer), out);
  }
  return out;
}
const app = createApp();
const backend = collect(app._router.stack).filter((r) => r.path.startsWith('/api'))
  .map((r) => ({ ...r, path: r.path.replace(/^\/api/, '').replace(/\/$/, '') || '/', regex: new RegExp(`^${r.path.replace(/^\/api/, '').replace(/\/$/, '').replace(/:[A-Za-z]+/g, '[^/]+')}$`) }));

// --- extract the frontend calls ---
const CALL = /\b(get|post|put|patch|del|http\.get|http\.post|http\.put|http\.patch|http\.delete)\(\s*(`[^`]*`|'[^']*')/g;
const METHOD = { get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', del: 'DELETE' };
const calls = [];
for (const file of fs.readdirSync(apiDir).filter((f) => f.endsWith('.js') && !f.includes('.test.') && !['client.js', 'index.js', 'tokenStore.js'].includes(f))) {
  const src = fs.readFileSync(path.join(apiDir, file), 'utf8');
  for (const m of src.matchAll(CALL)) {
    const fn = m[1].replace('http.', '');
    const raw = m[2].slice(1, -1).replace(/\$\{[^}]+\}/g, ':p');
    calls.push({ file, method: METHOD[fn], path: raw });
  }
}

test('the route table was read correctly (sanity)', () => {
  assert.ok(backend.length > 60, `expected 60+ backend routes, found ${backend.length}`);
  assert.ok(backend.some((r) => r.method === 'POST' && r.path === '/auth/login'));
  assert.ok(backend.some((r) => r.method === 'POST' && r.path === '/bookings/:id/accept'));
});
test('the frontend API modules were scanned (sanity)', () => { assert.ok(calls.length > 60, `expected 60+ frontend calls, found ${calls.length}`); });
test('every frontend API call matches a real backend route (method and path)', () => {
  const missing = calls.filter((c) => !backend.some((r) => r.method === c.method && r.regex.test(c.path)));
  assert.deepEqual(missing.map((c) => `${c.method} ${c.path} (${c.file})`), [], 'frontend calls an endpoint the backend does not have');
});
test('(informational) backend routes the UI never calls', () => {
  const unused = backend.filter((r) => !calls.some((c) => c.method === r.method && r.regex.test(c.path)));
  console.log('# backend routes with no frontend caller:', unused.map((r) => `${r.method} ${r.path}`).join(', ') || 'none');
});
