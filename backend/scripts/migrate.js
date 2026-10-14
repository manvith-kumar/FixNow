// Sequential migration runner. Applies database/migrations/NNN_*.sql in order, once each.
// Each file runs in its own session; applied files are recorded in schema_migrations with a checksum.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { adminConnection, MIGRATIONS_DIR } from './_cli.js';

const conn = await adminConnection(true);
await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  filename VARCHAR(190) NOT NULL PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

const [appliedRows] = await conn.query('SELECT filename, checksum FROM schema_migrations');
const applied = new Map(appliedRows.map((r) => [r.filename, r.checksum]));
const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();

let count = 0;
for (const file of files) {
  const sql = fs.readFileSync(`${MIGRATIONS_DIR}/${file}`, 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  if (applied.has(file)) {
    if (applied.get(file) !== checksum) console.warn(`WARNING: ${file} was modified after it was applied. Create a new migration instead.`);
    continue;
  }
  console.log(`Applying ${file} ...`);
  try {
    await conn.query(sql);
    await conn.query('INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)', [file, checksum]);
    count++;
  } catch (err) {
    console.error(`Migration ${file} failed: ${err.message}`);
    console.error('DDL statements are not transactional in MySQL: inspect the database, fix the file, and re-run (drop partially created tables if needed).');
    await conn.end();
    process.exit(1);
  }
}
console.log(count ? `Applied ${count} migration(s).` : 'Database is up to date.');
await conn.end();
