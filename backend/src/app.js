import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import api from './routes/index.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.isProduction ? 1 : false);
  app.use(helmet());
  app.use(cors({
    origin(origin, cb) { // explicit allow-list; non-browser clients (no Origin header) are allowed
      if (!origin || env.frontendOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', apiLimiter, api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
