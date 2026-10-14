import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/http.js';
import { pool, queryOne } from '../db/pool.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role, tv: user.token_version }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256',
  });
}

function extractToken(req) {
  const h = req.headers.authorization;
  if (!h) return null;
  const [scheme, token] = h.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/** Verifies the JWT, then re-loads the user from MySQL so role, status and revocation are always current. */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw AppError.unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    throw new AppError(401, err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      err.name === 'TokenExpiredError' ? 'Your session has expired. Please log in again.' : 'Invalid authentication token');
  }
  const user = await queryOne(pool,
    'SELECT id, email, full_name, phone, role, status, token_version FROM users WHERE id = ?', [payload.sub]);
  if (!user || user.token_version !== payload.tv) throw new AppError(401, 'INVALID_TOKEN', 'Session is no longer valid. Please log in again.');
  if (user.status !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  req.user = user;
  next();
});

/** Always the DB role - never a role claimed by the client. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (!roles.includes(req.user.role)) return next(AppError.forbidden());
  next();
};

/** Authenticates when a token is supplied, otherwise continues anonymously (public catalogue endpoints). */
export const optionalAuth = (req, res, next) => (req.headers.authorization ? authenticate(req, res, next) : next());
