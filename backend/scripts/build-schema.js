// Regenerates database/schema.sql by concatenating the ordered migrations, so schema.sql never drifts.
import fs from 'node:fs';
import { MIGRATIONS_DIR } from './_cli.js';
const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
let out = '-- FixNow full schema (GENERATED from database/migrations by `npm run db:schema`).\n-- Do not edit by hand. Import into an EMPTY database, or use `npm run db:migrate` instead.\n\n';
for (const f of files) out += `-- >>> ${f}\n${fs.readFileSync(`${MIGRATIONS_DIR}/${f}`, 'utf8').trim()}\n\n`;
fs.writeFileSync(`${MIGRATIONS_DIR}/../schema.sql`, out);
console.log(`schema.sql written from ${files.length} migrations.`);
