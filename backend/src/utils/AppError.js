export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.isAppError = true;
  }
  static badRequest(msg = 'Bad request', details) { return new AppError(400, 'BAD_REQUEST', msg, details); }
  static unauthorized(msg = 'Authentication required') { return new AppError(401, 'UNAUTHORIZED', msg); }
  static forbidden(msg = 'You do not have permission to perform this action') { return new AppError(403, 'FORBIDDEN', msg); }
  static notFound(msg = 'Resource not found') { return new AppError(404, 'NOT_FOUND', msg); }
  static conflict(msg = 'Conflict', code = 'CONFLICT') { return new AppError(409, code, msg); }
  static unprocessable(msg, code = 'UNPROCESSABLE') { return new AppError(422, code, msg); }
}
