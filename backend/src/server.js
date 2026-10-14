import { env } from './config/env.js';
import { createApp } from './app.js';
import { checkConnection, pool } from './db/pool.js';
import { logger } from './utils/logger.js';

try { await checkConnection(); logger.info(`Database connection OK (${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME})`); }
catch (e) { logger.error(`Cannot connect to MySQL: ${e.message}. Check backend/.env and that MySQL is running.`); process.exit(1); }

const server = createApp().listen(env.PORT, () => logger.info(`FixNow API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`));
const shutdown = () => { server.close(async () => { await pool.end(); process.exit(0); }); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
