import { Bot, InlineKeyboard, Context, NextFunction } from 'grammy';
import QRCode from 'qrcode';
import { env } from '../config/env';
import { IChatProvider } from '../core/interfaces/chat.interface';
import { ISummarizer } from '../core/interfaces/summarizer.interface';
import { IChatInfo } from '../core/types/summary.types';
import { MessageFormatterService } from './message-formatter.service';
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
          `⛔ *Access Denied*\n\n` +
          `Your Telegram ID is \`${userId}\`.\n` +
          `To authorize this account, add your ID to \`ALLOWED_TELEGRAM_USER_IDS\` in your \`.env\` file.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      await next();
    });
  }

  private setupCommands(): void {
    // /start command
    this.bot.command(['start', 'help'], async (ctx) => {
      const status = this.chatProvider.getStatus();
      const statusEmoji = status.state === 'READY' ? '🟢 Connected' : `🟡 ${status.state}`;

      const keyboard = new InlineKeyboard()
        .text('🔴 Unread Chats', 'nav:unread:1')
        .text('👥 Active Groups', 'nav:groups:1')
        .row()
        .text('💬 Personal Chats', 'nav:direct:1')
        .text('⚡ Status & Info', 'nav:status')
        .row()
        .text('📱 WhatsApp QR Code', 'nav:qr');

      const welcomeMessage =
        `🤖 *WhatsApp Chat Summarizer Bot*\n\n` +
        `WhatsApp Status: *${statusEmoji}*\n` +
        (status.pushname ? `Account: *${status.pushname}* (${status.phoneNumber || ''})\n` : '') +
        `Mistral Model: \`${env.MISTRAL_MODEL}\`\n\n` +
        `*Quick Commands:*\n` +
        `• /unread - View chats with unread messages\n` +
        `• /groups - View active WhatsApp groups\n` +
        `• /chats - View recent personal chats\n` +
        `• /summarize <name> - Summarize chat by name\n` +
        `• /qr - Show WhatsApp connection QR code\n` +
        `• /status - Check service health\n\n` +
        `Tap an action below to get started:`;

      await ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
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
          `ℹ️ *Usage:* \`/summarize <chat name or group name>\`\n\n` +
          `Example: \`/summarize Project Alpha\` or \`/summarize John\``,
          { parse_mode: 'Markdown' }
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
        // Do not fail if message was not modified
        if (err?.description?.includes('message is not modified')) {
          return;
        }
        await ctx.reply(`⚠️ Could not complete request: ${err?.message || 'Error occurred'}`);
      }
    });
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
      const msg = `⚠️ WhatsApp is not ready (*${status.state}*). Use /qr to authenticate first.`;
      if (isEdit) await ctx.editMessageText(msg, { parse_mode: 'Markdown' }).catch(() => ctx.reply(msg, { parse_mode: 'Markdown' }));
      else await ctx.reply(msg, { parse_mode: 'Markdown' });
      return;
    }

    const limit = 6;
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
      const emptyMsg = `🎉 *No ${category === 'unread' ? 'unread messages' : 'chats found'}!*`;
      const backKeyboard = new InlineKeyboard().text('🔙 Back to Menu', 'nav:status');
      if (isEdit) {
        await ctx.editMessageText(emptyMsg, { parse_mode: 'Markdown', reply_markup: backKeyboard }).catch(() => ctx.reply(emptyMsg, { parse_mode: 'Markdown', reply_markup: backKeyboard }));
      } else {
        await ctx.reply(emptyMsg, { parse_mode: 'Markdown', reply_markup: backKeyboard });
      }
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
    navRow.push(InlineKeyboard.text(`Page ${page}/${pagination.totalPages}`, `noop`));
    if (pagination.hasNextPage) {
      navRow.push(InlineKeyboard.text('Next ▶️', `nav:${category}:${page + 1}`));
    }
    keyboard.row(...navRow);
    keyboard.row().text('🔄 Refresh', `nav:${category}:${page}`);

    const text =
      `📋 *${categoryTitle}*\n` +
      `Showing ${items.length} of ${pagination.total} total chats.\n\n` +
      `_Tap any chat below to summarize recent messages with Mistral AI:_`;

    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }).catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard }));
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  }

  /**
   * Execute chat summarization pipeline and reply to Telegram
   */
  private async executeSummarization(ctx: Context, chatIdentifier: string): Promise<void> {
    const status = this.chatProvider.getStatus();
    if (status.state !== 'READY') {
      await ctx.reply(`⚠️ WhatsApp is not connected. Use /qr to authenticate.`);
      return;
    }

    const progressMsg = await ctx.reply(
      `⏳ *Fetching chat messages...*\n_Please wait a moment while we analyze the conversation._`,
      { parse_mode: 'Markdown' }
    );

    try {
      const chatInfo = await this.chatProvider.getChatById(chatIdentifier);
      const chatName = chatInfo ? chatInfo.name : chatIdentifier;
      const isGroup = chatInfo ? chatInfo.isGroup : true;
      const limit = chatInfo && chatInfo.unreadCount > 20
        ? Math.min(chatInfo.unreadCount + 10, 250)
        : env.DEFAULT_SUMMARY_MESSAGE_LIMIT;

      await ctx.api.editMessageText(
        ctx.chat!.id,
        progressMsg.message_id,
        `⏳ *Fetched messages from "${MessageFormatterService.escapeMarkdown(chatName)}".*\n` +
        `🤖 *Summarizing with Mistral AI (${env.MISTRAL_MODEL})...*`,
        { parse_mode: 'Markdown' }
      );

      const messages = await this.chatProvider.getChatMessages(chatIdentifier, limit);

      if (messages.length === 0) {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          progressMsg.message_id,
          `⚠️ No messages found to summarize for *${MessageFormatterService.escapeMarkdown(chatName)}*.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const summary = await this.summarizer.summarize(messages, {
        chatId: chatIdentifier,
        chatName,
        isGroup,
        model: env.MISTRAL_MODEL,
      });

      const formattedMarkdown = MessageFormatterService.formatSummaryToMarkdown(summary);

      // Telegram message limit is 4096 characters. If summary is long, split it safely.
      if (formattedMarkdown.length <= 4000) {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          progressMsg.message_id,
          formattedMarkdown,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.api.deleteMessage(ctx.chat!.id, progressMsg.message_id);
        await this.sendChunkedMessages(ctx, formattedMarkdown);
      }
    } catch (err: any) {
      logger.error({ error: err.message, chatIdentifier }, 'Summarization failed in Telegram bot');
      await ctx.api.editMessageText(
        ctx.chat!.id,
        progressMsg.message_id,
        `❌ *Summarization Failed:*\n${MessageFormatterService.escapeMarkdown(err.message)}`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  private async sendSystemStatus(ctx: Context, isEdit = false): Promise<void> {
    const status = this.chatProvider.getStatus();
    const uptimeSec = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);

    const text =
      `⚡ *System & WhatsApp Status*\n\n` +
      `• *WhatsApp State:* \`${status.state}\`\n` +
      (status.pushname ? `• *Account Name:* ${status.pushname}\n` : '') +
      (status.phoneNumber ? `• *Phone Number:* +${status.phoneNumber}\n` : '') +
      `• *Mistral Model:* \`${env.MISTRAL_MODEL}\`\n` +
      `• *Process Uptime:* ${hours}h ${mins}m\n` +
      `• *Memory Usage:* ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\n`;

    const keyboard = new InlineKeyboard()
      .text('🔴 Unread Chats', 'nav:unread:1')
      .text('👥 Groups', 'nav:groups:1')
      .row()
      .text('🔄 Refresh Status', 'nav:status');

    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  }

  private async sendQRCode(ctx: Context): Promise<void> {
    const status = this.chatProvider.getStatus();

    if (status.state === 'READY') {
      await ctx.reply('✅ WhatsApp is already connected and ready!');
      return;
    }

    if (!status.qrCodeRaw) {
      await ctx.reply(
        `⏳ WhatsApp client is currently *${status.state}*.\nQR code is not generated yet. Please wait a few seconds and try again.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    try {
      const qrBuffer = await QRCode.toBuffer(status.qrCodeRaw);
      await ctx.replyWithPhoto(
        new (await import('grammy')).InputFile(qrBuffer, 'whatsapp-qr.png'),
        {
          caption:
            '📱 *Scan this QR Code with WhatsApp:*\n1. Open WhatsApp on your phone\n2. Tap Linked Devices > Link a Device\n3. Scan this image',
          parse_mode: 'Markdown',
        }
      );
    } catch (e: any) {
      await ctx.reply(`⚠️ Could not render QR image: ${e.message}`);
    }
  }

  private async sendChunkedMessages(ctx: Context, text: string): Promise<void> {
    const maxLen = 3900;
    const parts: string[] = [];
    let cur = text;

    while (cur.length > maxLen) {
      let splitAt = cur.lastIndexOf('\n\n', maxLen);
      if (splitAt === -1) splitAt = cur.lastIndexOf('\n', maxLen);
      if (splitAt === -1) splitAt = maxLen;

      parts.push(cur.slice(0, splitAt));
      cur = cur.slice(splitAt).trim();
    }
    if (cur.length > 0) parts.push(cur);

    for (let i = 0; i < parts.length; i++) {
      const pageIndicator = parts.length > 1 ? `_(Part ${i + 1}/${parts.length})_\n\n` : '';
      await ctx.reply(`${pageIndicator}${parts[i]}`, { parse_mode: 'Markdown' });
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
