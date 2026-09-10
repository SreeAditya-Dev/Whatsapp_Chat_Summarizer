import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { HttpError } from '../../core/errors/http-error';

/**
 * Optional API key authentication middleware for REST endpoints
 * If API_KEY is set in environment, requires 'x-api-key' or 'Authorization: Bearer <key>'
 */
export function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!env.API_KEY) {
    // No API key configured: allow request
    return next();
  }

  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  const providedKey = apiKeyHeader || bearerToken;

  if (!providedKey || providedKey !== env.API_KEY) {
    throw HttpError.unauthorized('Invalid or missing API key', 'UNAUTHORIZED');
  }

  next();
}
