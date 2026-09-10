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

  getStatus(): ChatProviderStatus {
    return this.status;
  }

  /**
   * Fetch all unread chats with pagination
   */
  async getUnreadChats(pagination?: PaginationParams): Promise<PaginatedResult<IChatInfo>> {
    this.ensureReady();

    const chats = await this.client!.getChats();
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
    this.ensureReady();

    let chats = await this.client!.getChats();

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
    } catch {
      // Fallback: search by name
      const chats = await this.client!.getChats();
      const lower = chatId.toLowerCase();
      const matched = chats.find(
        (c) =>
          c.name?.toLowerCase().includes(lower) ||
          (c as any).formattedTitle?.toLowerCase().includes(lower)
      );
      if (matched) return this.mapChatToInfo(matched);
    }

    return null;
  }

  /**
   * Fetch recent messages from a chat, preserving sender names and quoted replies
   */
  async getChatMessages(chatId: string, limit = 100): Promise<IChatMessage[]> {
    this.ensureReady();

    let targetChat: Chat;
    try {
      targetChat = await this.client!.getChatById(chatId);
    } catch {
      // Try search by name if chatId wasn't an exact serialized ID
      const chats = await this.client!.getChats();
      const lower = chatId.toLowerCase();
      const found = chats.find(
        (c) =>
          c.name?.toLowerCase().includes(lower) ||
          (c as any).formattedTitle?.toLowerCase().includes(lower)
      );
      if (!found) {
        throw new Error(`Chat not found for identifier: "${chatId}"`);
      }
      targetChat = found;
    }

    const effectiveLimit = Math.min(Math.max(10, limit), 500);
    logger.info({ chatName: targetChat.name, limit: effectiveLimit }, 'Fetching messages from WhatsApp');

    const rawMessages: Message[] = await targetChat.fetchMessages({
      limit: effectiveLimit,
    });

    const parsedMessages: IChatMessage[] = [];

    for (const msg of rawMessages) {
      // Skip system notifications or empty protocol messages
      if (!msg.body && !msg.hasMedia) continue;

      let senderName = 'Unknown';
      let senderNumber = '';

      if (msg.fromMe) {
        senderName = 'Me';
      } else {
        try {
          const contact = await msg.getContact();
          senderName = contact.pushname || contact.name || contact.shortName || contact.number || 'User';
          senderNumber = contact.number || '';
        } catch {
          senderName = (msg as any)._data?.notifyName || msg.author || msg.from;
        }
      }

      let isQuoted = false;
      let quotedMessage: { senderName: string; body: string } | undefined;

      if (msg.hasQuotedMsg) {
        try {
          const quoted = await msg.getQuotedMessage();
          if (quoted) {
            let quotedSender = 'User';
            if (quoted.fromMe) {
              quotedSender = 'Me';
            } else {
              const qContact = await quoted.getContact().catch(() => null);
              quotedSender = qContact?.pushname || qContact?.name || 'User';
            }

            isQuoted = true;
            quotedMessage = {
              senderName: quotedSender,
              body: quoted.body || (quoted.hasMedia ? '[Media]' : ''),
            };
          }
        } catch (e: any) {
          logger.debug({ error: e.message }, 'Could not resolve quoted message');
        }
      }

      parsedMessages.push({
        id: msg.id._serialized,
        senderName,
        senderNumber,
        timestamp: new Date(msg.timestamp * 1000),
        body: msg.body || (msg.hasMedia ? '[Media File]' : ''),
        isQuoted,
        quotedMessage,
        hasMedia: msg.hasMedia,
        mediaType: msg.type,
      });
    }

    return parsedMessages;
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
    return {
      id: chat.id._serialized,
      name: chat.name || rawChat.formattedTitle || 'Unnamed Chat',
      isGroup: chat.isGroup,
      unreadCount: chat.unreadCount || 0,
      lastMessageTimestamp: chat.timestamp ? chat.timestamp * 1000 : undefined,
      participantCount: chat.isGroup ? rawChat.participants?.length : undefined,
    };
  }

  private ensureReady(): void {
    if (this.status.state !== 'READY' || !this.client) {
      throw new Error(
        `WhatsApp client is not ready. Current state: ${this.status.state}. Please scan the QR code to pair.`
      );
    }
  }
}
