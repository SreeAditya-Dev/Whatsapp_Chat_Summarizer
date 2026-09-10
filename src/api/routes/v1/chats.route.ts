import { Router, Request, Response, NextFunction } from 'express';
import { IChatProvider, ChatFilterType } from '../../../core/interfaces/chat.interface';
import { ApiResponseHelper } from '../../../utils/api-response';

export function createChatsRouter(chatProvider: IChatProvider): Router {
  const router = Router();

  /**
   * GET /api/v1/chats
   * Query params:
   *  - page: number (default 1)
   *  - limit: number (default 10)
   *  - filter: 'all' | 'groups' | 'direct' (default 'all')
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const filter = (req.query.filter as ChatFilterType) || 'all';

      const result = await chatProvider.getRecentChats({ page, limit }, filter);
      res.json(ApiResponseHelper.success(result.items, result.pagination));
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/chats/unread
   * Query params:
   *  - page: number (default 1)
   *  - limit: number (default 10)
   */
  router.get('/unread', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;

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
        res.status(404).json(ApiResponseHelper.error(`Chat not found: ${chatId}`, 'CHAT_NOT_FOUND'));
        return;
      }

      res.json(ApiResponseHelper.success(chat));
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/chats/:chatId/messages
   * Query params:
   *  - limit: number (default 50, max 200)
   */
  router.get('/:chatId/messages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chatId = String(req.params.chatId);
      const limit = parseInt(req.query.limit as string, 10) || 50;

      const messages = await chatProvider.getChatMessages(chatId, limit);
      res.json(ApiResponseHelper.success(messages));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
