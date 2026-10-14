
import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { env, BACKEND_ROOT } from '../src/config/env.js';
import path from 'node:path';

export const MIGRATIONS_DIR = path.resolve(BACKEND_ROOT, '../database/migrations');
export const SEEDS_DIR = path.resolve(BACKEND_ROOT, '../database/seeds');

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

export function adminConnection(withDatabase = true) {
  return mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: withDatabase ? env.DB_NAME : undefined,
    multipleStatements: true,
    charset: 'utf8mb4',
    dateStrings: true,
    ...(ssl ? { ssl } : {}),
  });
}

export { env };
