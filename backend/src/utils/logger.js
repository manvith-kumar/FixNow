import { env } from '../config/env.js';
const redact = (v) => (typeof v === 'string' ? v.replace(/(password|token|secret)=[^&\s]+/gi, '$1=[redacted]') : v);
const fmt = (level, msg, meta) => `${new Date().toISOString()} [${level}] ${redact(msg)}${meta ? ' ' + JSON.stringify(meta) : ''}`;
export const logger = {
  info: (m, meta) => { if (!env.isTest) console.log(fmt('info', m, meta)); },
  warn: (m, meta) => { if (!env.isTest) console.warn(fmt('warn', m, meta)); },
  error: (m, meta) => { if (!env.isTest) console.error(fmt('error', m, meta)); },
};
