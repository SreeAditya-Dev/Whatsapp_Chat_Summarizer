import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../../../core/errors/http-error';
import { IChatProvider } from '../../../core/interfaces/chat.interface';
import { MistralSummarizerService } from '../../../services/mistral.service';
import { SettingsService } from '../../../services/settings.service';
import { ApiResponseHelper } from '../../../utils/api-response';
import { logger } from '../../../utils/logger';

const draftReplySchema = z.object({
  chatId: z.string().min(1, 'chatId is required'),
  instruction: z.string().max(500).optional(),
  tone: z.enum(['casual', 'friendly', 'professional', 'concise']).optional(),
  messageLimit: z.number().int().min(3).max(50).optional(),
});

const sendReplySchema = z.object({
  chatId: z.string().min(1, 'chatId is required'),
  message: z.string().min(1, 'Message text cannot be empty').max(4000),
});

export function createReplyRouter(
  chatProvider: IChatProvider,
  summarizer: any
): Router {
  const router = Router();

  /**
   * POST /api/v1/reply/draft
   * Generates a context-aware human-like reply draft with alternative suggestions.
   */
  router.post('/draft', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = draftReplySchema.safeParse(req.body);
      if (!parsed.success) {
        throw HttpError.badRequest(
          'Validation failed for draft request',
          'VALIDATION_ERROR',
          parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        );
      }

      const { chatId, instruction, tone, messageLimit } = parsed.data;
      const settings = SettingsService.getSettings();

      if (!settings.aiReply.enabled) {
        throw HttpError.forbidden('AI replies are currently disabled in Settings.', 'AI_REPLIES_DISABLED');
      }

      const isAllowed = SettingsService.isChatAllowedForReply(chatId);
      if (!isAllowed) {
        throw HttpError.forbidden(
          'This chat is not on the admin-approved whitelist for AI replies. Check Settings.',
          'CHAT_NOT_ALLOWED'
        );
      }

      const chatInfo = await chatProvider.getChatById(chatId);
      const realChatId = chatInfo?.id ?? chatId;
      const chatName = chatInfo ? chatInfo.name : chatId;
      const isGroup = chatInfo ? chatInfo.isGroup : false;

      const messages = await chatProvider.getChatMessages(realChatId, messageLimit || 15);
      if (messages.length === 0) {
        throw HttpError.badRequest(`No recent messages found in "${chatName}" to draft a reply to.`, 'NO_MESSAGES');
      }

      let result: { reply: string; suggestions: string[] };
      if (typeof summarizer?.generateReply === 'function') {
        result = await summarizer.generateReply({
          chatId: realChatId,
          chatName,
          isGroup,
          messages,
          instruction,
          tone: tone || settings.aiReply.defaultTone || 'casual',
          senderPersona: settings.aiReply.customPersona || undefined,
        });
      } else {
        result = {
          reply: `Thanks for the update! Sounds good to me.`,
          suggestions: ['Got it, thanks!', 'I will follow up shortly.'],
        };
      }

      res.status(200).json(
        ApiResponseHelper.success({
          chatId: realChatId,
          chatName,
          isGroup,
          reply: result.reply,
          suggestions: result.suggestions,
        })
      );
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/reply/send
   * Dispatches a single verified reply to WhatsApp. Bulk sending is strictly forbidden.
   */
  router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = sendReplySchema.safeParse(req.body);
      if (!parsed.success) {
        throw HttpError.badRequest(
          'Validation failed for send request',
          'VALIDATION_ERROR',
          parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        );
      }

      const { chatId, message } = parsed.data;
      const settings = SettingsService.getSettings();

      if (!settings.aiReply.enabled) {
        throw HttpError.forbidden('AI replies are currently disabled in Settings.', 'AI_REPLIES_DISABLED');
      }

      const isAllowed = SettingsService.isChatAllowedForReply(chatId);
      if (!isAllowed) {
        throw HttpError.forbidden(
          'Sending to this chat is not permitted by whitelist settings.',
          'CHAT_NOT_ALLOWED'
        );
      }

      const chatInfo = await chatProvider.getChatById(chatId);
      const realChatId = chatInfo?.id ?? chatId;
      const chatName = chatInfo ? chatInfo.name : chatId;

      logger.info({ chatId: realChatId, chatName }, 'Dispatching single human-approved reply');
      const sendResult = await chatProvider.sendMessage(realChatId, message);

      res.status(200).json(
        ApiResponseHelper.success({
          delivered: true,
          chatId: realChatId,
          chatName,
          messageId: sendResult.messageId,
          timestamp: sendResult.timestamp.toISOString(),
          sentText: message,
        })
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}
