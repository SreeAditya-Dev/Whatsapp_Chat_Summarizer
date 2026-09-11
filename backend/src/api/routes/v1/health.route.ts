import { Router, Request, Response } from 'express';
import { env } from '../../../config/env';
import { IChatProvider } from '../../../core/interfaces/chat.interface';
import { ApiResponseHelper } from '../../../utils/api-response';

export function createHealthRouter(chatProvider: IChatProvider): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    const waStatus = chatProvider.getStatus();
    const uptime = process.uptime();

    res.json(
      ApiResponseHelper.success({
        status: 'ok',
        version: '1.0.0',
        environment: env.NODE_ENV,
        uptimeSeconds: Math.floor(uptime),
        services: {
          whatsapp: {
            state: waStatus.state,
            connected: waStatus.state === 'READY',
            account: waStatus.pushname || null,
          },
          ai: {
            provider: 'Mistral AI',
            model: env.MISTRAL_MODEL,
          },
        },
        memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      })
    );
  });

  return router;
}
