import mysql from 'mysql2/promise';
import { env, BACKEND_ROOT } from '../src/config/env.js';
import path from 'node:path';

export const MIGRATIONS_DIR = path.resolve(BACKEND_ROOT, '../database/migrations');
export const SEEDS_DIR = path.resolve(BACKEND_ROOT, '../database/seeds');

export function adminConnection(withDatabase = true) {
  return mysql.createConnection({
    host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD,
    database: withDatabase ? env.DB_NAME : undefined,
    multipleStatements: true, charset: 'utf8mb4', dateStrings: true,
  });
}
export { env };
