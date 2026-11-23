/**
 * Centralised application errors.
 * Messages are safe to return to clients: they never contain internals,
 * credentials, stack traces or personal data.
 */

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this operation.') {
    super(403, 'FORBIDDEN', message);
  }
}

/**
 * Also used for cross-tenant record access so record ids cannot be enumerated
 * (a farmer probing another farmer's case id gets the same answer as a
 * genuinely missing record).
 */
export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'The resource was modified concurrently. Reload and retry.') {
    super(409, 'CONFLICT', message);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string) {
    super(400, 'PAYLOAD_TOO_LARGE', message);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string) {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(code: string, message: string) {
    super(503, code, message);
  }
}