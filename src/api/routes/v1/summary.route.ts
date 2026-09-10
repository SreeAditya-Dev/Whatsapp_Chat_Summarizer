import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { env } from '../../../config/env';
import { IChatProvider } from '../../../core/interfaces/chat.interface';
import { ISummarizer } from '../../../core/interfaces/summarizer.interface';
import { ApiResponseHelper } from '../../../utils/api-response';

const summarizeRequestSchema = z.object({
  chatId: z.string().min(1, 'chatId is required'),
  messageLimit: z.number().int().min(5).max(500).optional().default(100),
  model: z.string().optional(),
});

export function createSummaryRouter(
  chatProvider: IChatProvider,
  summarizer: ISummarizer
): Router {
  const router = Router();

  /**
   * POST /api/v1/summarize
   * Request Body: { chatId: string, messageLimit?: number, model?: string }
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedBody = summarizeRequestSchema.safeParse(req.body);

      if (!parsedBody.success) {
        res.status(400).json(
          ApiResponseHelper.error(
            'Validation failed',
            'VALIDATION_ERROR',
            parsedBody.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
          )
        );
        return;
      }

      const { chatId, messageLimit, model } = parsedBody.data;

      const chatInfo = await chatProvider.getChatById(chatId);
      const chatName = chatInfo ? chatInfo.name : chatId;
      const isGroup = chatInfo ? chatInfo.isGroup : true;

      const messages = await chatProvider.getChatMessages(chatId, messageLimit);

      if (messages.length === 0) {
        res.status(400).json(
          ApiResponseHelper.error(
            `No messages found in chat "${chatName}" to summarize.`,
            'NO_MESSAGES'
          )
        );
        return;
      }

      const summary = await summarizer.summarize(messages, {
        chatId,
        chatName,
        isGroup,
        model: model || env.MISTRAL_MODEL,
      });

      res.status(200).json(ApiResponseHelper.success(summary));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
