import { adminConnection, env } from './_cli.js';
const name = env.DB_NAME;
if (!/^[A-Za-z0-9_]+$/.test(name)) { console.error('DB_NAME may only contain letters, digits and underscores.'); process.exit(1); }
const conn = await adminConnection(false);
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
console.log(`Database "${name}" is ready.`);
await conn.end();
