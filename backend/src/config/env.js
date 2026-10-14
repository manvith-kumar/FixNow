
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

const bool = (def) =>
  z.preprocess(
    (v) =>
      v === undefined || v === ''
        ? def
        : String(v).toLowerCase() === 'true',
    z.boolean(),
  );

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  FRONTEND_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  // MySQL / TiDB connection
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),

  // TLS is enabled explicitly for cloud database connections.
  DB_SSL: bool(false),
  DB_SSL_CA: z.string().default('certs/isrgrootx1.pem'),

  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(14).default(10),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  DEV_EXPOSE_RESET_TOKEN: bool(false),

  // Uploads
  UPLOAD_DIR: z.string().default('storage/uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),

  // Rate limiting
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  // Optional email configuration
  SMTP_HOST: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');

  console.error(
    `\nInvalid or missing environment configuration:\n${lines}\n\nCopy backend/.env.example to backend/.env and fill in the values.\n`,
  );
  process.exit(1);
}

const e = parsed.data;

export const env = {
  ...e,
  isProduction: e.NODE_ENV === 'production',
  isTest: e.NODE_ENV === 'test',
  uploadDir: path.isAbsolute(e.UPLOAD_DIR)
    ? e.UPLOAD_DIR
    : path.join(BACKEND_ROOT, e.UPLOAD_DIR),
  maxUploadBytes: Math.round(e.MAX_UPLOAD_MB * 1024 * 1024),
  frontendOrigins: e.FRONTEND_ORIGIN
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

if (env.isProduction && /replace-with|change_me/i.test(e.JWT_SECRET)) {
  console.error('Refusing to start in production with a placeholder JWT_SECRET.');
  process.exit(1);
}
