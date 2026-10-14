
import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { env, BACKEND_ROOT } from '../config/env.js';

// DECIMAL values remain strings for precision.
// Dates are returned as strings; timestamps are stored in UTC.
const ssl = env.DB_SSL
  ? {
      ca: readFileSync(
        path.isAbsolute(env.DB_SSL_CA)
          ? env.DB_SSL_CA
          : path.resolve(BACKEND_ROOT, env.DB_SSL_CA),
        'utf8',
      ),
      rejectUnauthorized: true,
    }
  : undefined;

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
  ...(ssl ? { ssl } : {}),
});

pool.pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

/** Run a parameterized query on a pool or transaction connection. */
export async function query(db, sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

export async function queryOne(db, sql, params = []) {
  const rows = await query(db, sql, params);
  return rows[0] ?? null;
}

/** Run INSERT/UPDATE/DELETE and return the ResultSetHeader. */
export async function exec(db, sql, params = []) {
  const [result] = await db.query(sql, params);
  return result;
}

/** Commit on success and roll back if the transaction fails. */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // Ignore rollback failure.
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function checkConnection() {
  await pool.query('SELECT 1');
  return true;
}
