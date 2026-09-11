import { Request, Response, NextFunction } from 'express';
import { env, isProduction } from '../../config/env';
import { HttpError } from '../../core/errors/http-error';
import { ApiResponseHelper } from '../../utils/api-response';
import { logger } from '../../utils/logger';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isHttpError = err instanceof HttpError;
  const statusCode = isHttpError ? err.statusCode : err.statusCode || err.status || 500;
  const code = isHttpError ? err.code : err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'Internal Server Error';

  // In production, mask internal error details unless explicitly an HttpError with safe details
  const details = isProduction
    ? isHttpError
      ? err.details
      : undefined
    : err.details || (err.stack ? { stack: err.stack } : undefined);

  if (statusCode === 503) {
    // Expected pre-pairing state (WhatsApp not linked yet) — keep it a one-liner, not an exception.
    logger.warn(
      {
        url: req.url,
        method: req.method,
        statusCode,
        code,
        message,
      },
      'Service temporarily unavailable'
    );
  } else if (statusCode >= 500) {
    logger.error(
      {
        err: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        statusCode,
      },
      'Server Exception in API route'
    );
  } else {
    logger.debug(
      {
        url: req.url,
        method: req.method,
        statusCode,
        code,
        message,
      },
      'Client error in API request'
    );
  }

  res.status(statusCode).json(ApiResponseHelper.error(message, code, details));
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(
    ApiResponseHelper.error(
      `Cannot ${req.method} ${req.originalUrl} - Endpoint not found`,
      'NOT_FOUND'
    )
  );
}
