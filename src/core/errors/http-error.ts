export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND'): HttpError {
    return new HttpError(404, code, message);
  }

  static badRequest(message = 'Invalid request', code = 'BAD_REQUEST', details?: unknown): HttpError {
    return new HttpError(400, code, message, details);
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED'): HttpError {
    return new HttpError(401, code, message);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN'): HttpError {
    return new HttpError(403, code, message);
  }

  static serviceUnavailable(message = 'Service unavailable', code = 'SERVICE_UNAVAILABLE'): HttpError {
    return new HttpError(503, code, message);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR', details?: unknown): HttpError {
    return new HttpError(500, code, message, details);
  }
}
