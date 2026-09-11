import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { APP_CONSTANTS } from '../../../config/constants';
import { HttpError } from '../../../core/errors/http-error';
import { IChatProvider, ChatFilterType } from '../../../core/interfaces/chat.interface';
import { ApiResponseHelper } from '../../../utils/api-response';

const chatsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(APP_CONSTANTS.DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(APP_CONSTANTS.MAX_API_LIMIT).default(APP_CONSTANTS.DEFAULT_LIMIT),
  filter: z.enum(['all', 'groups', 'direct']).default('all'),
  q: z.string().optional(),
});

const unreadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(APP_CONSTANTS.DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(APP_CONSTANTS.MAX_API_LIMIT).default(APP_CONSTANTS.DEFAULT_LIMIT),
});

const messagesQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(APP_CONSTANTS.MAX_SUMMARY_MESSAGE_LIMIT)
    .default(50),
});

export function createChatsRouter(chatProvider: IChatProvider): Router {
  const router = Router();

  /**
   * GET /api/v1/chats/search?q=9092345559
   */
  router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = String(req.query.q || '').trim();
      const limit = Number(req.query.limit) || 20;
      if (!q) {
        return res.json(ApiResponseHelper.success([]));
      }
      if (typeof chatProvider.searchChats === 'function') {
        const results = await chatProvider.searchChats(q, limit);
        return res.json(ApiResponseHelper.success(results));
      }
      return res.json(ApiResponseHelper.success([]));
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/chats
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = chatsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw HttpError.badRequest('Invalid query parameters', 'VALIDATION_ERROR', parsed.error.issues);
      }

      const { page, limit, filter, q } = parsed.data;

      if (q && q.trim()) {
        if (typeof chatProvider.searchChats === 'function') {
          const results = await chatProvider.searchChats(q.trim(), limit);
          return res.json(ApiResponseHelper.success(results));
        }
      }

      const result = await chatProvider.getRecentChats({ page, limit }, filter as ChatFilterType);
      res.json(ApiResponseHelper.success(result.items, result.pagination));
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/chats/unread
   */
  router.get('/unread', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = unreadQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw HttpError.badRequest('Invalid query parameters', 'VALIDATION_ERROR', parsed.error.issues);
      }

      const { page, limit } = parsed.data;
      const result = await chatProvider.getUnreadChats({ page, limit });
      res.json(ApiResponseHelper.success(result.items, result.pagination));
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/chats/:chatId
   */
  router.get('/:chatId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chatId = String(req.params.chatId);
      const chat = await chatProvider.getChatById(chatId);

      if (!chat) {
        throw HttpError.notFound(`Chat not found: ${chatId}`, 'CHAT_NOT_FOUND');
      }

      res.json(ApiResponseHelper.success(chat));
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/chats/:chatId/messages
   */
  router.get('/:chatId/messages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chatId = String(req.params.chatId);
      const parsed = messagesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw HttpError.badRequest('Invalid limit parameter', 'VALIDATION_ERROR', parsed.error.issues);
      }

      const messages = await chatProvider.getChatMessages(chatId, parsed.data.limit);
      res.json(ApiResponseHelper.success(messages));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
