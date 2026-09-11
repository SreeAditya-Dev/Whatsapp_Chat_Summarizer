import { Bot, InlineKeyboard, Context, NextFunction, InputFile } from 'grammy';
import QRCode from 'qrcode';
import { env } from '../config/env';
import { APP_CONSTANTS } from '../config/constants';
import { IChatProvider } from '../core/interfaces/chat.interface';
import { ISummarizer } from '../core/interfaces/summarizer.interface';
import { MessageFormatterService } from './message-formatter.service';
import { escapeHtml } from '../utils/html-escape';
import { logger } from '../utils/logger';

export class TelegramBotService {
  private bot: Bot;
  private chatProvider: IChatProvider;
  private summarizer: ISummarizer;
  private isRunning = false;

  constructor(chatProvider: IChatProvider, summarizer: ISummarizer) {
    this.chatProvider = chatProvider;
    this.summarizer = summarizer;
    this.bot = new Bot(env.TELEGRAM_BOT_TOKEN);

    this.setupSecurityMiddleware();
    this.setupCommands();
    this.setupCallbackQueries();
  }

  /**
   * Security Middleware: Restricts access to authorized Telegram User IDs only
   */
  private setupSecurityMiddleware(): void {
    this.bot.use(async (ctx: Context, next: NextFunction) => {
      const userId = ctx.from?.id;
      const allowed = env.ALLOWED_TELEGRAM_USER_IDS;

      if (allowed.length > 0 && (!userId || !allowed.includes(userId))) {
        logger.warn(
          { userId, username: ctx.from?.username },
          'Blocked unauthorized Telegram access attempt'
        );
        await ctx.reply(
          `⛔ <b>Access Denied</b>\n\n` +
          `Your Telegram ID is <code>${escapeHtml(String(userId || 'unknown'))}</code>.\n` +
          `To authorize this account, add your ID to <code>ALLOWED_TELEGRAM_USER_IDS</code> in your <code>.env</code> file.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      await next();
    });
  }

  private setupCommands(): void {
    // /start and /help command
    this.bot.command(['start', 'help'], async (ctx) => {
      const status = this.chatProvider.getStatus();
      const statusEmoji = status.state === 'READY' ? '🟢 Connected' : `🟡 ${escapeHtml(status.state)}`;

      const keyboard = new InlineKeyboard()
        .text('🔴 Unread Chats', 'nav:unread:1')
        .text('👥 Active Groups', 'nav:groups:1')
        .row()
        .text('💬 Personal Chats', 'nav:direct:1')
        .text('⚡ Status & Info', 'nav:status')
        .row()
        .text('📱 WhatsApp QR Code', 'nav:qr');

      const welcomeMessage =
        `🤖 <b>WhatsApp Chat Summarizer Bot</b>\n\n` +
        `WhatsApp Status: <b>${statusEmoji}</b>\n` +
        (status.pushname ? `Account: <b>${escapeHtml(status.pushname)}</b> (${escapeHtml(status.phoneNumber || '')})\n` : '') +
        `Mistral Model: <code>${escapeHtml(env.MISTRAL_MODEL)}</code>\n\n` +
        `<b>Quick Commands:</b>\n` +
        `• /unread - View chats with unread messages\n` +
        `• /groups - View active WhatsApp groups\n` +
        `• /chats - View recent personal chats\n` +
        `• /summarize &lt;name&gt; - Summarize chat by name\n` +
        `• /qr - Show WhatsApp connection QR code\n` +
        `• /status - Check service health\n\n` +
        `Tap an action below to get started:`;

      await ctx.reply(welcomeMessage, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    });

    // /status command
    this.bot.command('status', async (ctx) => {
      await this.sendSystemStatus(ctx);
    });

    // /qr command
    this.bot.command('qr', async (ctx) => {
      await this.sendQRCode(ctx);
    });

    // /unread command
    this.bot.command('unread', async (ctx) => {
      await this.sendChatList(ctx, 'unread', 1);
    });

    // /groups command
    this.bot.command('groups', async (ctx) => {
      await this.sendChatList(ctx, 'groups', 1);
    });

    // /chats command
    this.bot.command('chats', async (ctx) => {
      await this.sendChatList(ctx, 'direct', 1);
    });

    // /summarize <name> command
    this.bot.command('summarize', async (ctx) => {
      const text = ctx.match?.trim();
      if (!text) {
        await ctx.reply(
          `ℹ️ <b>Usage:</b> <code>/summarize &lt;chat name or group name&gt;</code>\n\n` +
          `Example: <code>/summarize Project Alpha</code> or <code>/summarize John</code>`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      await this.executeSummarization(ctx, text);
    });
  }

  private setupCallbackQueries(): void {
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;
      await ctx.answerCallbackQuery();

      // No-op buttons like page indicators
      if (data === 'noop') {
        return;
      }

      try {
        // Navigation: nav:unread:page, nav:groups:page, nav:direct:page
        if (data.startsWith('nav:')) {
          const parts = data.split(':');
          const category = parts[1];
          const page = parseInt(parts[2] || '1', 10);

          if (category === 'status') {
            await this.sendSystemStatus(ctx, true);
          } else if (category === 'qr') {
            await this.sendQRCode(ctx);
          } else if (category === 'unread' || category === 'groups' || category === 'direct') {
            await this.sendChatList(ctx, category, page, true);
          }
        }

        // Summarize action: sum:<chatId>
        else if (data.startsWith('sum:')) {
          const chatId = data.substring(4);
          await this.executeSummarization(ctx, chatId);
        }
      } catch (err: any) {
        logger.error({ error: err?.stack || err?.message || err, data }, 'Error handling Telegram callback query');
        if (err?.description?.includes('message is not modified')) {
          return;
        }
        await ctx.reply(`⚠️ Could not complete request: ${err?.message || 'Error occurred'}`);
      }
    });
  }

  /**
   * Safely edit or reply, falling back to plain text if HTML entity parsing fails
   */
  private async safeEditOrReply(
    ctx: Context,
    isEdit: boolean,
    text: string,
    options: { parse_mode?: 'HTML' | 'Markdown'; reply_markup?: any } = {}
  ): Promise<void> {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    if (isEdit && ctx.callbackQuery?.message?.message_id) {
      try {
        await ctx.editMessageText(text, options);
        return;
      } catch (err: any) {
        if (err?.description?.includes('message is not modified')) {
          return;
        }
        // Fallback to sending plain text without tags if entity parse failed
        if (options.parse_mode && err?.description?.includes('parse entities')) {
          try {
            await ctx.editMessageText(text.replace(/<[^>]*>/g, ''), { reply_markup: options.reply_markup });
            return;
          } catch {}
        }
      }
    }

    try {
      await ctx.reply(text, options);
    } catch (err: any) {
      if (options.parse_mode && err?.description?.includes('parse entities')) {
        await ctx.reply(text.replace(/<[^>]*>/g, ''), { reply_markup: options.reply_markup });
      } else {
        throw err;
      }
    }
  }

  /**
   * Render and send paginated chat lists with one-click summarize buttons
   */
  private async sendChatList(
    ctx: Context,
    category: 'unread' | 'groups' | 'direct',
    page = 1,
    isEdit = false
  ): Promise<void> {
    const status = this.chatProvider.getStatus();
    if (status.state !== 'READY') {
      const msg = `⚠️ WhatsApp is not ready (<b>${escapeHtml(status.state)}</b>). Use /qr to authenticate first.`;
      await this.safeEditOrReply(ctx, isEdit, msg, { parse_mode: 'HTML' });
      return;
    }

    const limit = APP_CONSTANTS.TELEGRAM_CHATS_PER_PAGE;
    let paginatedResult;

    if (category === 'unread') {
      paginatedResult = await this.chatProvider.getUnreadChats({ page, limit });
    } else {
      paginatedResult = await this.chatProvider.getRecentChats({ page, limit }, category);
    }

    const { items, pagination } = paginatedResult;
    const categoryTitle =
      category === 'unread'
        ? '🔴 Unread Chats'
        : category === 'groups'
        ? '👥 Active WhatsApp Groups'
        : '💬 Personal Chats';

    if (items.length === 0) {
      const emptyMsg = `🎉 <b>No ${category === 'unread' ? 'unread messages' : 'chats found'}!</b>`;
      const backKeyboard = new InlineKeyboard().text('🔙 Back to Menu', 'nav:status');
      await this.safeEditOrReply(ctx, isEdit, emptyMsg, { parse_mode: 'HTML', reply_markup: backKeyboard });
      return;
    }

    const keyboard = new InlineKeyboard();

    items.forEach((chat) => {
      const badge = chat.unreadCount > 0 ? ` (${chat.unreadCount} unread)` : '';
      const icon = chat.isGroup ? '👥' : '👤';
      const displayName = (chat.name || 'Chat').slice(0, 22);
      const label = `${icon} ${displayName}${badge}`;
      keyboard.text(label, `sum:${chat.id}`).row();
    });

    // Pagination row
    const navRow = [];
    if (pagination.hasPrevPage) {
      navRow.push(InlineKeyboard.text('◀️ Prev', `nav:${category}:${page - 1}`));
    }
    navRow.push(InlineKeyboard.text(`Page ${page}/${pagination.totalPages}`, 'noop'));
    if (pagination.hasNextPage) {
      navRow.push(InlineKeyboard.text('Next ▶️', `nav:${category}:${page + 1}`));
    }
    keyboard.row(...navRow);
    keyboard.row().text('🔄 Refresh', `nav:${category}:${page}`);

    const text =
      `📋 <b>${escapeHtml(categoryTitle)}</b>\n` +
      `Showing ${items.length} of ${pagination.total} total chats.\n\n` +
      `<i>Tap any chat below to summarize recent messages with Mistral AI:</i>`;

    await this.safeEditOrReply(ctx, isEdit, text, { parse_mode: 'HTML', reply_markup: keyboard });
  }

  /**
   * Execute chat summarization pipeline and reply to Telegram safely using HTML
   */
  private async executeSummarization(ctx: Context, chatIdentifier: string): Promise<void> {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const status = this.chatProvider.getStatus();
    if (status.state !== 'READY') {
      await ctx.reply('⚠️ WhatsApp is not connected. Use /qr to authenticate.');
      return;
    }

    const progressMsg = await ctx.reply(
      `⏳ <b>Fetching chat messages...</b>\n<i>Please wait a moment while we analyze the conversation.</i>`,
      { parse_mode: 'HTML' }
    );

    try {
      const chatInfo = await this.chatProvider.getChatById(chatIdentifier);
      const targetChatId = chatInfo?.id ?? chatIdentifier;
      const chatName = chatInfo ? chatInfo.name : chatIdentifier;
      const isGroup = chatInfo ? chatInfo.isGroup : true;
      const unreadCount = chatInfo ? chatInfo.unreadCount : 0;
      const limit = unreadCount > 0
        ? Math.min(unreadCount + APP_CONSTANTS.PREVIOUS_CONTEXT_MESSAGE_COUNT, APP_CONSTANTS.MAX_SUMMARY_MESSAGE_LIMIT)
        : APP_CONSTANTS.DEFAULT_SUMMARY_MESSAGE_LIMIT;

      try {
        await ctx.api.editMessageText(
          chatId,
          progressMsg.message_id,
          `⏳ <b>Fetched info for "${escapeHtml(chatName)}".</b>\n` +
          (unreadCount > 0 ? `🔴 <b>Unread count:</b> ${unreadCount}\n` : `✅ <b>All messages read</b>\n`) +
          `🤖 <b>Summarizing with Mistral AI (${escapeHtml(env.MISTRAL_MODEL)})...</b>`,
          { parse_mode: 'HTML' }
        );
      } catch {}

      const messages = await this.chatProvider.getChatMessages(targetChatId, limit);

      if (messages.length === 0) {
        await ctx.api.editMessageText(
          chatId,
          progressMsg.message_id,
          `⚠️ No messages found to summarize for <b>${escapeHtml(chatName)}</b>.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      const summary = await this.summarizer.summarize(messages, {
        chatId: targetChatId,
        chatName,
        isGroup,
        unreadCount,
        model: env.MISTRAL_MODEL,
      });

      const formattedHtml = MessageFormatterService.formatSummaryToHtml(summary);

      // Telegram message limit is 4096 characters
      if (formattedHtml.length <= APP_CONSTANTS.TELEGRAM_MAX_MESSAGE_LENGTH) {
        try {
          await ctx.api.editMessageText(
            chatId,
            progressMsg.message_id,
            formattedHtml,
            { parse_mode: 'HTML' }
          );
        } catch (editErr: any) {
          logger.warn({ err: editErr?.message }, 'Failed to edit with HTML, falling back to plain text');
          const plainText = MessageFormatterService.formatSummaryToPlainText(summary);
          await ctx.api.editMessageText(chatId, progressMsg.message_id, plainText);
        }
      } else {
        await ctx.api.deleteMessage(chatId, progressMsg.message_id).catch(() => {});
        await this.sendChunkedMessages(ctx, formattedHtml, MessageFormatterService.formatSummaryToPlainText(summary));
      }
    } catch (err: any) {
      logger.error({ error: err.message, chatIdentifier }, 'Summarization failed in Telegram bot');
      const failHtml = `❌ <b>Summarization Failed:</b>\n${escapeHtml(err.message || 'Unknown error')}`;
      try {
        await ctx.api.editMessageText(
          chatId,
          progressMsg.message_id,
          failHtml,
          { parse_mode: 'HTML' }
        );
      } catch {
        await ctx.reply(`❌ Summarization Failed:\n${err.message || 'Unknown error'}`).catch(() => {});
      }
    }
  }

  private async sendSystemStatus(ctx: Context, isEdit = false): Promise<void> {
    const status = this.chatProvider.getStatus();
    const uptimeSec = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);

    const text =
      `⚡ <b>System &amp; WhatsApp Status</b>\n\n` +
      `• <b>WhatsApp State:</b> <code>${escapeHtml(status.state)}</code>\n` +
      (status.pushname ? `• <b>Account Name:</b> ${escapeHtml(status.pushname)}\n` : '') +
      (status.phoneNumber ? `• <b>Phone Number:</b> +${escapeHtml(status.phoneNumber)}\n` : '') +
      `• <b>Mistral Model:</b> <code>${escapeHtml(env.MISTRAL_MODEL)}</code>\n` +
      `• <b>Process Uptime:</b> ${hours}h ${mins}m\n` +
      `• <b>Memory Usage:</b> ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\n`;

    const keyboard = new InlineKeyboard()
      .text('🔴 Unread Chats', 'nav:unread:1')
      .text('👥 Groups', 'nav:groups:1')
      .row()
      .text('🔄 Refresh Status', 'nav:status');

    await this.safeEditOrReply(ctx, isEdit, text, { parse_mode: 'HTML', reply_markup: keyboard });
  }

  private async sendQRCode(ctx: Context): Promise<void> {
    const status = this.chatProvider.getStatus();

    if (status.state === 'READY') {
      await ctx.reply('✅ WhatsApp is already connected and ready!');
      return;
    }

    if (!status.qrCodeRaw) {
      await ctx.reply(
        `⏳ WhatsApp client is currently <b>${escapeHtml(status.state)}</b>.\nQR code is not generated yet. Please wait a few seconds and try again.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    try {
      const qrBuffer = await QRCode.toBuffer(status.qrCodeRaw);
      await ctx.replyWithPhoto(
        new InputFile(qrBuffer, 'whatsapp-qr.png'),
        {
          caption:
            '📱 <b>Scan this QR Code with WhatsApp:</b>\n1. Open WhatsApp on your phone\n2. Tap Linked Devices > Link a Device\n3. Scan this image',
          parse_mode: 'HTML',
        }
      );
    } catch (e: any) {
      await ctx.reply(`⚠️ Could not render QR image: ${e.message}`);
    }
  }

  private async sendChunkedMessages(ctx: Context, htmlText: string, plainFallback?: string): Promise<void> {
    const maxLen = APP_CONSTANTS.TELEGRAM_CHUNK_SAFE_LENGTH;
    const parts: string[] = [];
    let cur = htmlText;

    while (cur.length > maxLen) {
      let splitAt = cur.lastIndexOf('\n\n', maxLen);
      if (splitAt === -1) splitAt = cur.lastIndexOf('\n', maxLen);
      if (splitAt === -1) splitAt = maxLen;

      parts.push(cur.slice(0, splitAt));
      cur = cur.slice(splitAt).trim();
    }
    if (cur.length > 0) parts.push(cur);

    for (let i = 0; i < parts.length; i++) {
      const pageIndicator = parts.length > 1 ? `<i>(Part ${i + 1}/${parts.length})</i>\n\n` : '';
      try {
        await ctx.reply(`${pageIndicator}${parts[i]}`, { parse_mode: 'HTML' });
      } catch (err: any) {
        logger.warn({ err: err?.message }, 'HTML chunk send failed, falling back to plain text');
        const plainPart = plainFallback
          ? plainFallback.slice(i * maxLen, (i + 1) * maxLen)
          : parts[i].replace(/<[^>]*>/g, '');
        const plainIndicator = parts.length > 1 ? `(Part ${i + 1}/${parts.length})\n\n` : '';
        await ctx.reply(`${plainIndicator}${plainPart}`);
      }
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('Starting Telegram Bot long-polling...');
    this.bot.start({
      onStart: (botInfo) => {
        logger.info({ botUsername: botInfo.username }, 'Telegram Bot successfully started!');
      },
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    await this.bot.stop();
    logger.info('Telegram Bot stopped.');
  }
}
