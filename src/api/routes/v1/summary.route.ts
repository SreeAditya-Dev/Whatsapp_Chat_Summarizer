import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { APP_CONSTANTS } from '../../../config/constants';
import { env } from '../../../config/env';
import { HttpError } from '../../../core/errors/http-error';
import { IChatProvider } from '../../../core/interfaces/chat.interface';
import { ISummarizer } from '../../../core/interfaces/summarizer.interface';
import { ApiResponseHelper } from '../../../utils/api-response';

const summarizeRequestSchema = z.object({
  chatId: z.string().min(1, 'chatId is required'),
  messageLimit: z
    .number()
    .int()
    .min(APP_CONSTANTS.MIN_SUMMARY_MESSAGE_LIMIT)
    .max(APP_CONSTANTS.MAX_SUMMARY_MESSAGE_LIMIT)
    .optional(),
  model: z.string().optional(),
});

export function createSummaryRouter(
  chatProvider: IChatProvider,
  summarizer: ISummarizer
): Router {
  const router = Router();

  /**
   * POST /api/v1/summarize
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedBody = summarizeRequestSchema.safeParse(req.body);

      if (!parsedBody.success) {
        throw HttpError.badRequest(
          'Validation failed for summarize request',
          'VALIDATION_ERROR',
          parsedBody.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        );
      }

      const { chatId, messageLimit, model } = parsedBody.data;

      const chatInfo = await chatProvider.getChatById(chatId);
      const realChatId = chatInfo?.id ?? chatId;
      const chatName = chatInfo ? chatInfo.name : chatId;
      const isGroup = chatInfo ? chatInfo.isGroup : true;
      const unreadCount = chatInfo ? chatInfo.unreadCount : 0;

      const effectiveLimit =
        messageLimit !== undefined
          ? messageLimit
          : unreadCount > 0
          ? Math.min(unreadCount + APP_CONSTANTS.PREVIOUS_CONTEXT_MESSAGE_COUNT, APP_CONSTANTS.MAX_SUMMARY_MESSAGE_LIMIT)
          : APP_CONSTANTS.DEFAULT_SUMMARY_MESSAGE_LIMIT;

      const messages = await chatProvider.getChatMessages(realChatId, effectiveLimit);

      if (messages.length === 0) {
        throw HttpError.badRequest(
          `No readable messages found in chat "${chatName}" to summarize.`,
          'NO_MESSAGES'
        );
      }

      const summary = await summarizer.summarize(messages, {
        chatId: realChatId,
        chatName,
        isGroup,
        unreadCount,
        model: model || env.MISTRAL_MODEL,
      });

      res.status(200).json(ApiResponseHelper.success(summary));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
