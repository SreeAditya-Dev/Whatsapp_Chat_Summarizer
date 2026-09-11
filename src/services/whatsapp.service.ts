import EventEmitter from 'events';
import fs from 'fs';
import { Client, LocalAuth, Message, Chat } from 'whatsapp-web.js';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import { env } from '../config/env';
import { IChatProvider, ChatFilterType, ChatProviderStatus } from '../core/interfaces/chat.interface';
import { PaginationParams, PaginatedResult } from '../core/types/api.types';
import { IChatInfo, IChatMessage } from '../core/types/summary.types';
import { ApiResponseHelper } from '../utils/api-response';
import { HttpError } from '../core/errors/http-error';
import { logger } from '../utils/logger';

export class WhatsAppService extends EventEmitter implements IChatProvider {
  private client: Client | null = null;
  private status: ChatProviderStatus = {
    state: 'DISCONNECTED',
  };

  constructor() {
    super();
  }

  /**
   * Find available Chrome executable path on Windows or specified in env
   */
  private getChromePath(): string | undefined {
    if (env.CHROME_PATH && fs.existsSync(env.CHROME_PATH)) {
      return env.CHROME_PATH;
    }

    const defaultWindowsPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];

    for (const p of defaultWindowsPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return undefined;
  }

  /**
   * Initialize WhatsApp Web client and attach event listeners
   */
  async initialize(): Promise<void> {
    if (this.client) {
      logger.warn('WhatsApp client is already initialized.');
      return;
    }

    this.status.state = 'INITIALIZING';
    this.emit('status_changed', this.status);

    const chromePath = this.getChromePath();
    logger.info({ chromePath }, 'Initializing WhatsApp Web client');

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth',
      }),
      puppeteer: {
        headless: env.HEADLESS,
        executablePath: chromePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      },
    });

    this.setupEventListeners();
    await this.client.initialize();
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('qr', async (qr: string) => {
      logger.info('WhatsApp QR Code generated. Scan with WhatsApp on your phone:');
      qrcodeTerminal.generate(qr, { small: true });

      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        this.status = {
          state: 'QR_READY',
          qrCodeRaw: qr,
          qrCodeDataUrl: qrDataUrl,
        };
        this.emit('qr', { qr, qrDataUrl });
        this.emit('status_changed', this.status);
      } catch (err: any) {
        logger.error({ error: err.message }, 'Failed to generate QR data URL');
      }
    });

    this.client.on('authenticated', () => {
      logger.info('WhatsApp authenticated successfully.');
      this.status.state = 'AUTHENTICATED';
      this.status.qrCodeRaw = undefined;
      this.status.qrCodeDataUrl = undefined;
      this.emit('authenticated');
      this.emit('status_changed', this.status);
    });

    this.client.on('ready', async () => {
      const info = this.client?.info;
      this.status = {
        state: 'READY',
        pushname: info?.pushname,
        phoneNumber: info?.wid?.user,
        lastConnectedAt: new Date().toISOString(),
      };

      logger.info(
        { user: this.status.pushname, phone: this.status.phoneNumber },
        'WhatsApp client is ready and connected!'
      );

      this.emit('ready', this.status);
      this.emit('status_changed', this.status);
    });

    this.client.on('auth_failure', (msg: string) => {
      logger.error({ msg }, 'WhatsApp authentication failure.');
      this.status.state = 'AUTH_FAILURE';
      this.emit('auth_failure', msg);
      this.emit('status_changed', this.status);
    });

    this.client.on('disconnected', (reason: string) => {
      logger.warn({ reason }, 'WhatsApp client disconnected.');
      this.status.state = 'DISCONNECTED';
      this.emit('disconnected', reason);
      this.emit('status_changed', this.status);
    });
  }

  /**
   * Safely inject in-browser error handling for WWebJS getChats to prevent 'r' exceptions
   */
  private async injectChatSafetyPatch(): Promise<void> {
    const pupPage = (this.client as any)?.pupPage;
    if (!pupPage) return;

    try {
      await pupPage.evaluate(() => {
        const w = (globalThis as any).window;
        if (!w || !w.WWebJS) return;

        // Wrap getChats with fault-tolerance
        w.WWebJS.getChats = async () => {
          try {
            const collections = w.require ? w.require('WAWebCollections') : null;
            const chatCollection = collections?.Chat;
            if (!chatCollection) return [];
            const chats = chatCollection.getModelsArray ? chatCollection.getModelsArray() : [];

            const chatPromises = chats.map(async (chat: any) => {
              try {
                return await w.WWebJS.getChatModel(chat);
              } catch {
                try {
                  const rawId = chat.id?._serialized || chat.id;
                  return {
                    id: { _serialized: rawId, ...chat.id },
                    name: chat.name || chat.formattedTitle || 'Chat',
                    formattedTitle: chat.formattedTitle || chat.name || 'Chat',
                    isGroup: Boolean(chat.isGroup),
                    isMuted: false,
                    unreadCount: chat.unreadCount || 0,
                    timestamp: chat.t || chat.timestamp || 0,
                  };
                } catch {
                  return null;
                }
              }
            });

            const results = await Promise.all(chatPromises);
            return results.filter(Boolean);
          } catch {
            return [];
          }
        };
      });
    } catch (e: any) {
      logger.debug({ error: e?.message }, 'Could not evaluate in-browser chat safety patch');
    }
  }

  /**
   * Safely retrieve chats with automatic in-browser patch injection
   */
  private async safeGetChats(): Promise<Chat[]> {
    this.ensureReady();
    await this.injectChatSafetyPatch();
    try {
      return await this.client!.getChats();
    } catch (err: any) {
      logger.warn({ error: err?.message || err }, 'First getChats attempt encountered issue, retrying with patch');
      await this.injectChatSafetyPatch();
      return await this.client!.getChats();
    }
  }

  /**
   * Fetch all unread chats with pagination
   */
  async getUnreadChats(pagination?: PaginationParams): Promise<PaginatedResult<IChatInfo>> {
    const chats = await this.safeGetChats();
    const unread = chats.filter((c) => c.unreadCount > 0);

    // Sort by unread count descending (chats with most unreads first)
    unread.sort((a, b) => b.unreadCount - a.unreadCount);

    const chatInfos: IChatInfo[] = unread.map((chat) => this.mapChatToInfo(chat));
    return ApiResponseHelper.sliceArrayWithPagination(
      chatInfos,
      pagination?.page,
      pagination?.limit
    );
  }

  /**
   * Fetch recent chats (groups, direct messages, or all) with pagination
   */
  async getRecentChats(
    pagination?: PaginationParams,
    filter: ChatFilterType = 'all'
  ): Promise<PaginatedResult<IChatInfo>> {
    let chats = await this.safeGetChats();

    if (filter === 'groups') {
      chats = chats.filter((c) => c.isGroup);
    } else if (filter === 'direct') {
      chats = chats.filter((c) => !c.isGroup);
    }

    const chatInfos: IChatInfo[] = chats.map((chat) => this.mapChatToInfo(chat));
    return ApiResponseHelper.sliceArrayWithPagination(
      chatInfos,
      pagination?.page,
      pagination?.limit
    );
  }

  /**
   * Get a specific chat by ID or name
   */
  async getChatById(chatId: string): Promise<IChatInfo | null> {
    this.ensureReady();

    try {
      // First try exact ID match
      const chat = await this.client!.getChatById(chatId);
      if (chat) return this.mapChatToInfo(chat);
    } catch (err: any) {
      logger.debug({ err: err?.message, chatId }, 'Exact ID lookup failed, trying fallback search');
    }

    try {
      // If chatId looks like a pure phone number (no @), try direct contact lookup with @c.us
      const cleanDigits = chatId.replace(/\D/g, '');
      if (cleanDigits && !chatId.includes('@')) {
        try {
          const directChat = await this.client!.getChatById(`${cleanDigits}@c.us`);
          if (directChat) return this.mapChatToInfo(directChat);
        } catch {
          // Continue to fallback list search
        }
      }

      const chats = await this.safeGetChats();
      const lower = chatId.toLowerCase();
      const queryDigits = chatId.replace(/\D/g, '');

      const matched = chats.find((c) => {
        const raw = c as any;
        if (c.id?._serialized?.toLowerCase() === lower) return true;
        if (c.name?.toLowerCase().includes(lower)) return true;
        if (raw.formattedTitle?.toLowerCase().includes(lower)) return true;
        if (queryDigits.length >= 4) {
          if (c.id?.user?.includes(queryDigits)) return true;
          if (c.name && c.name.replace(/\D/g, '').includes(queryDigits)) return true;
        }
        return false;
      });

      if (matched) return this.mapChatToInfo(matched);
    } catch (err: any) {
      logger.warn({ err: err?.message, chatId }, 'Fallback search failed');
    }

    return null;
  }

  /**
   * Fetch recent messages from a chat, preserving sender names and quoted replies
   * Uses sender caching and concurrent batching to avoid N+1 serial roundtrip bottlenecks.
   */
  async getChatMessages(chatId: string, limit = 100): Promise<IChatMessage[]> {
    this.ensureReady();

    let targetChat: Chat;
    try {
      targetChat = await this.client!.getChatById(chatId);
    } catch (err: any) {
      logger.debug({ err: err?.message, chatId }, 'Exact chat lookup failed, trying name search fallback');
      const chats = await this.safeGetChats();
      const lower = chatId.toLowerCase();
      const found = chats.find(
        (c) =>
          c.name?.toLowerCase().includes(lower) ||
          (c as any).formattedTitle?.toLowerCase().includes(lower)
      );
      if (!found) {
        throw HttpError.notFound(`Chat not found for identifier: "${chatId}"`, 'CHAT_NOT_FOUND');
      }
      targetChat = found;
    }

    const effectiveLimit = Math.min(Math.max(5, limit), 500);
    logger.info({ chatName: targetChat.name, limit: effectiveLimit }, 'Fetching messages from WhatsApp');

    const rawMessages: Message[] = await targetChat.fetchMessages({
      limit: effectiveLimit,
    });

    const contactCache = new Map<string, { name: string; number: string }>();

    const resolveSender = async (msg: Message): Promise<{ name: string; number: string }> => {
      if (msg.fromMe) return { name: 'Me', number: '' };

      const senderKey = msg.author || msg.from;
      if (contactCache.has(senderKey)) {
        return contactCache.get(senderKey)!;
      }

      // Fast-path: check pre-populated notifyName from WhatsApp Web
      const notifyName = (msg as any)._data?.notifyName;
      if (notifyName) {
        const info = { name: notifyName, number: '' };
        contactCache.set(senderKey, info);
        return info;
      }

      try {
        const contact = await msg.getContact();
        const info = {
          name: contact.pushname || contact.name || contact.shortName || contact.number || 'User',
          number: contact.number || '',
        };
        contactCache.set(senderKey, info);
        return info;
      } catch (err: any) {
        logger.debug({ err: err?.message, senderKey }, 'Contact lookup failed, using fallback ID');
        const fallback = { name: senderKey.split('@')[0] || 'User', number: '' };
        contactCache.set(senderKey, fallback);
        return fallback;
      }
    };

    const resolveQuoted = async (msg: Message): Promise<{ senderName: string; body: string } | undefined> => {
      if (!msg.hasQuotedMsg) return undefined;
      try {
        const quoted = await msg.getQuotedMessage();
        if (!quoted) return undefined;

        let quotedSender = 'User';
        if (quoted.fromMe) {
          quotedSender = 'Me';
        } else {
          const qSender = await resolveSender(quoted);
          quotedSender = qSender.name;
        }

        return {
          senderName: quotedSender,
          body: quoted.body || (quoted.hasMedia ? '[Media]' : ''),
        };
      } catch (e: any) {
        logger.debug({ error: e?.message }, 'Could not resolve quoted message');
        return undefined;
      }
    };

    const batchSize = 10;
    const parsedMessages: IChatMessage[] = [];

    for (let i = 0; i < rawMessages.length; i += batchSize) {
      const batch = rawMessages.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (msg): Promise<IChatMessage | null> => {
          if (!msg.body && !msg.hasMedia) return null;

          const sender = await resolveSender(msg);
          const quoted = await resolveQuoted(msg);

          return {
            id: msg.id._serialized,
            senderName: sender.name,
            senderNumber: sender.number,
            timestamp: new Date(msg.timestamp * 1000),
            body: msg.body || (msg.hasMedia ? '[Media File]' : ''),
            isQuoted: Boolean(quoted),
            quotedMessage: quoted,
            hasMedia: msg.hasMedia,
            mediaType: msg.type,
          };
        })
      );

      parsedMessages.push(...batchResults.filter((m): m is IChatMessage => m !== null));
    }

    return parsedMessages;
  }

  /**
   * Send a single message to a chat (person or group).
   * Strictly single-message send to prevent any bulk sending or spamming.
   */
  async sendMessage(chatId: string, message: string): Promise<{ messageId: string; timestamp: Date }> {
    this.ensureReady();
    if (!message || !message.trim()) {
      throw HttpError.badRequest('Message content cannot be empty', 'INVALID_MESSAGE');
    }

    let targetChat: Chat;
    try {
      targetChat = await this.client!.getChatById(chatId);
    } catch (err: any) {
      const chats = await this.safeGetChats();
      const lower = chatId.toLowerCase();
      const found = chats.find(
        (c) =>
          c.name?.toLowerCase().includes(lower) ||
          (c as any).formattedTitle?.toLowerCase().includes(lower)
      );
      if (!found) {
        throw HttpError.notFound(`Chat not found for identifier: "${chatId}"`, 'CHAT_NOT_FOUND');
      }
      targetChat = found;
    }

    logger.info({ chatId: targetChat.id._serialized, chatName: targetChat.name }, 'Sending single WhatsApp message');
    const sent = await targetChat.sendMessage(message.trim());

    return {
      messageId: sent.id._serialized,
      timestamp: new Date(sent.timestamp * 1000),
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err: any) {
        logger.error({ error: err.message }, 'Error while destroying WhatsApp client');
      } finally {
        this.client = null;
        this.status.state = 'DISCONNECTED';
        this.emit('status_changed', this.status);
      }
    }
  }

  private mapChatToInfo(chat: Chat): IChatInfo {
    const rawChat = chat as any;
    const phoneNumber = !chat.isGroup && chat.id?.user ? chat.id.user : undefined;
    const name = chat.name || rawChat.formattedTitle || (phoneNumber ? `+${phoneNumber}` : 'Unnamed Chat');
    return {
      id: chat.id._serialized,
      name,
      isGroup: chat.isGroup,
      unreadCount: chat.unreadCount || 0,
      lastMessageTimestamp: chat.timestamp ? chat.timestamp * 1000 : undefined,
      participantCount: chat.isGroup ? rawChat.participants?.length : undefined,
      phoneNumber,
      formattedTitle: rawChat.formattedTitle,
    };
  }

  getStatus(): ChatProviderStatus {
    if (this.client?.info && this.status.state !== 'READY') {
      this.status.state = 'READY';
      this.status.pushname = this.client.info.pushname;
      this.status.phoneNumber = this.client.info.wid?.user;
    }
    return this.status;
  }

  private ensureReady(): void {
    if (this.client?.info && this.status.state !== 'READY') {
      this.status.state = 'READY';
      this.status.pushname = this.client.info.pushname;
      this.status.phoneNumber = this.client.info.wid?.user;
    }

    if (!this.client || (this.status.state !== 'READY' && this.status.state !== 'AUTHENTICATED')) {
      throw HttpError.serviceUnavailable(
        `WhatsApp client is not ready. Current state: ${this.status.state}. Please scan the QR code to pair.`,
        'SERVICE_UNAVAILABLE'
      );
    }
  }
}
