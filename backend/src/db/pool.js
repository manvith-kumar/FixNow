import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

// DECIMAL values come back as strings (exact), dates as strings (no JS Date timezone surprises).
// All timestamps are stored and compared in UTC.
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  dateStrings: true,
  decimalNumbers: false,
  timezone: 'Z',
  charset: 'utf8mb4',
  multipleStatements: false,
});

pool.pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

/** Run a query on a pool or a transaction connection. Parameters are always bound, never concatenated. */
export async function query(db, sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

export async function queryOne(db, sql, params = []) {
  const rows = await query(db, sql, params);
  return rows[0] ?? null;
}

/** Run INSERT/UPDATE/DELETE and return the ResultSetHeader (insertId, affectedRows). */
export async function exec(db, sql, params = []) {
  const [result] = await db.query(sql, params);
  return result;
}

/**
 * Run fn(conn) inside a transaction. Commits on success, rolls back on any thrown error.
 * Use SELECT ... FOR UPDATE inside fn for row-level concurrency control.
 */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignore rollback failure */ }
    throw err;
  } finally {
    conn.release();
  }
}

export async function checkConnection() {
  await pool.query('SELECT 1');
  return true;
}
