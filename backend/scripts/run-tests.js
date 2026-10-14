// Portable test runner (works on Windows/macOS/Linux and Node 18+): node scripts/run-tests.js [unit|integration|all]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const which = process.argv[2] ?? 'all';
const dirs = which === 'all' ? ['unit', 'integration'] : [which];
const files = dirs.flatMap((d) => {
  const dir = path.join(root, 'tests', d);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort().map((f) => path.join(dir, f)) : [];
});
if (!files.length) { console.error('No test files found'); process.exit(1); }
const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { stdio: 'inherit', cwd: root, env: process.env });
process.exit(r.status ?? 1);
