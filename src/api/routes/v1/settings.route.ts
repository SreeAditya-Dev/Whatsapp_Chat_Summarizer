import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../../../core/errors/http-error';
import { SettingsService } from '../../../services/settings.service';
import { ApiResponseHelper } from '../../../utils/api-response';

const updateSettingsSchema = z.object({
  summary: z
    .object({
      defaultDepth: z.enum(['compact', 'brief', 'detailed']).optional(),
      defaultMessageLimit: z.number().int().min(10).max(500).optional(),
    })
    .optional(),
  aiReply: z
    .object({
      enabled: z.boolean().optional(),
      autoReply: z.boolean().optional(),
      requireReview: z.boolean().optional(),
      defaultTone: z.enum(['casual', 'friendly', 'professional', 'concise']).optional(),
      customPersona: z.string().max(300).optional(),
      whitelistMode: z.enum(['all', 'selected']).optional(),
      allowedChatIds: z.array(z.string()).optional(),
    })
    .optional(),
});

export function createSettingsRouter(): Router {
  const router = Router();

  /**
   * GET /api/v1/settings
   */
  router.get('/', (_req: Request, res: Response) => {
    const settings = SettingsService.getSettings();
    res.status(200).json(ApiResponseHelper.success(settings));
  });

  /**
   * PUT /api/v1/settings
   */
  router.put('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw HttpError.badRequest(
          'Validation failed for settings update',
          'VALIDATION_ERROR',
          parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        );
      }

      const updated = SettingsService.updateSettings(parsed.data);
      res.status(200).json(ApiResponseHelper.success(updated));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
