import { Request, Response, NextFunction } from 'express';
import { ApiResponseHelper } from '../../utils/api-response';
import { logger } from '../../utils/logger';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  logger.error(
    {
      err,
      url: req.url,
      method: req.method,
      statusCode,
    },
    'Unhandled API Exception'
  );

  res.status(statusCode).json(ApiResponseHelper.error(message, code, err.details));
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(
    ApiResponseHelper.error(
      `Cannot ${req.method} ${req.originalUrl} - Endpoint not found`,
      'NOT_FOUND'
    )
  );
}
