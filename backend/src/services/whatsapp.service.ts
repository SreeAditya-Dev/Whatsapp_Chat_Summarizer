import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
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
  private contactNameCache = new Map<string, string>();

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
        dataPath: fs.existsSync(path.resolve(process.cwd(), '.wwebjs_auth'))
          ? path.resolve(process.cwd(), '.wwebjs_auth')
          : fs.existsSync(path.resolve(process.cwd(), '..', '.wwebjs_auth'))
            ? path.resolve(process.cwd(), '..', '.wwebjs_auth')
            : path.resolve(process.cwd(), '.wwebjs_auth'),
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

    this.client.on('message', async (msg: Message) => {
      try {
        if (msg.fromMe) return;
        if (
          msg.isStatus ||
          (msg as any).isBroadcast ||
          msg.from?.endsWith('@newsletter') ||
          msg.from?.endsWith('@broadcast') ||
          msg.from === 'status@broadcast'
        ) {
          return;
        }

        const chatId = msg.from;
        let chatName: string | undefined;
        let isGroup = false;

        try {
          const chat = await msg.getChat();
          chatName = chat?.name || (chat as any)?.formattedTitle;
          isGroup = chat?.isGroup || false;
        } catch {}

        const chatMessage: IChatMessage = {
          id:
            msg.id?._serialized ||
            (typeof msg.id === 'string' ? msg.id : (msg.id as any)?.id) ||
            `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          senderName: msg.author || msg.from,
          senderNumber: msg.from.replace(/\D/g, ''),
          timestamp: new Date(msg.timestamp * 1000),
          body: msg.body || '',
          isQuoted: Boolean((msg as any).hasQuotedMsg),
          hasMedia: msg.hasMedia,
          mediaType: msg.type,
        };

        this.emit('message_received', {
          chatId,
          message: chatMessage,
          chatName,
          isGroup,
          rawMessage: msg,
        });
      } catch (err: any) {
        logger.debug({ err: err?.message }, 'Error in WhatsApp message event handler');
      }
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
   * Search all WhatsApp chats and contacts by name or phone number:
   * Resolves person names for numbers like "90923 45559"
   */
  async searchChats(query: string, limit = 20): Promise<IChatInfo[]> {
    this.ensureReady();
    const q = query.trim();
    if (!q) return [];
    const lower = q.toLowerCase();
    const queryDigits = q.replace(/\D/g, '');

    const results: IChatInfo[] = [];
    const seenIds = new Set<string>();

    // 1. Search existing chats in memory
    const chats = await this.safeGetChats();
    for (const c of chats) {
      if (results.length >= limit) break;
      const jid = c.id?._serialized;
      if (!jid || seenIds.has(jid)) continue;

      let matched = false;
      if (jid.toLowerCase().includes(lower)) matched = true;
      if (c.name?.toLowerCase().includes(lower)) matched = true;
      if ((c as any).formattedTitle?.toLowerCase().includes(lower)) matched = true;

      if (queryDigits.length >= 4) {
        const userDigits = c.id?.user?.replace(/\D/g, '') || '';
        const nameDigits = c.name ? c.name.replace(/\D/g, '') : '';
        if (
          userDigits.includes(queryDigits) ||
          queryDigits.includes(userDigits) ||
          userDigits.endsWith(queryDigits) ||
          queryDigits.endsWith(userDigits) ||
          nameDigits.includes(queryDigits) ||
          queryDigits.includes(nameDigits)
        ) {
          matched = true;
        }
      }

      if (matched) {
        await this.enrichChatContactName(c);
        const info = this.mapChatToInfo(c);
        results.push(info);
        seenIds.add(jid);
      }
    }

    // 2. If limit not reached, search WhatsApp contacts list (phonebook & WhatsApp profiles)
    if (results.length < limit && typeof this.client!.getContacts === 'function') {
      try {
        const contacts = await this.client!.getContacts();
        for (const contact of contacts) {
          if (results.length >= limit) break;
          const cJid = contact.id?._serialized;
          if (!cJid || seenIds.has(cJid)) continue;

          let matched = false;
          const cName = contact.name || '';
          const cPush = contact.pushname || '';
          const cNumber = contact.number || contact.id?.user || '';

          if (cName.toLowerCase().includes(lower) || cPush.toLowerCase().includes(lower)) {
            matched = true;
          }

          if (queryDigits.length >= 4 && cNumber) {
            const numDigits = cNumber.replace(/\D/g, '');
            if (
              numDigits === queryDigits ||
              numDigits.includes(queryDigits) ||
              queryDigits.includes(numDigits) ||
              numDigits.endsWith(queryDigits) ||
              queryDigits.endsWith(numDigits)
            ) {
              matched = true;
            }
          }

          if (matched) {
            const personName = contact.name || contact.pushname || contact.shortName || (cNumber ? `+${cNumber}` : q);
            results.push({
              id: cJid,
              name: personName,
              isGroup: contact.isGroup || false,
              unreadCount: 0,
              phoneNumber: cNumber,
            });
            seenIds.add(cJid);
          }
        }
      } catch (err: any) {
        logger.debug({ err: err?.message }, 'Contacts search fallback skipped');
      }
    }

    // 3. If query is a phone number and still no match, query WhatsApp number verification
    if (results.length === 0 && queryDigits.length >= 7) {
      const candidates = [queryDigits];
      if (queryDigits.length === 10) {
        candidates.push(`91${queryDigits}`); // Default India country code
      }
      for (const cand of candidates) {
        try {
          const numberId = await this.client!.getNumberId(cand);
          if (numberId && !seenIds.has(numberId._serialized)) {
            const jid = numberId._serialized;
            let personName = `+${numberId.user}`;
            try {
              const contact = await this.client!.getContactById(jid);
              if (contact) {
                personName = contact.name || contact.pushname || contact.shortName || personName;
              }
            } catch {}

            results.push({
              id: jid,
              name: personName,
              isGroup: false,
              unreadCount: 0,
              phoneNumber: numberId.user,
            });
            seenIds.add(jid);
            break;
          }
        } catch {}
      }
    }

    return results;
  }

  /**
   * Get a specific chat by ID or name
   */
  async getChatById(chatId: string): Promise<IChatInfo | null> {
    this.ensureReady();

    // 1. Direct search using unified chat & contact lookup
    const searchMatches = await this.searchChats(chatId, 1);
    if (searchMatches.length > 0) {
      return searchMatches[0];
    }

    try {
      const chat = await this.client!.getChatById(chatId);
      if (chat) {
        await this.enrichChatContactName(chat);
        return this.mapChatToInfo(chat);
      }
    } catch {}

    return null;
  }

  /**
   * Fetch recent messages from a chat, preserving sender names and quoted replies
   * Uses sender caching and concurrent batching to avoid N+1 serial roundtrip bottlenecks.
   */
  async getChatMessages(chatId: string, limit = 100): Promise<IChatMessage[]> {
    this.ensureReady();

    let targetChat: Chat | undefined;
    try {
      targetChat = await this.client!.getChatById(chatId);
    } catch (err: any) {
      logger.debug({ err: err?.message, chatId }, 'Exact chat lookup failed, trying JID and name search fallback');
      try {
        const chats = await this.safeGetChats();
        const lower = chatId.toLowerCase();
        targetChat = chats.find(
          (c) =>
            c.id?._serialized === chatId ||
            c.id?.user === chatId ||
            c.name?.toLowerCase().includes(lower) ||
            (c as any).formattedTitle?.toLowerCase().includes(lower)
        );
      } catch {
        // Safe get chats search error ignored
      }
    }

    if (!targetChat) {
      logger.warn({ chatId }, 'Chat not currently indexed in WhatsApp Web store, returning empty message history');
      return [];
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
            id:
              msg.id?._serialized ||
              (typeof msg.id === 'string' ? msg.id : (msg.id as any)?.id) ||
              `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

    let targetChat: Chat | undefined;
    let resolvedChatId = chatId;
    let chatDisplayName = chatId;

    try {
      targetChat = await this.client!.getChatById(chatId);
      resolvedChatId = targetChat.id?._serialized || chatId;
      chatDisplayName = targetChat.name || (targetChat as any).formattedTitle || resolvedChatId;
    } catch {
      try {
        const chats = await this.safeGetChats();
        const lower = chatId.toLowerCase();
        targetChat = chats.find(
          (c) =>
            c.id?._serialized === chatId ||
            c.id?.user === chatId ||
            c.name?.toLowerCase().includes(lower) ||
            (c as any).formattedTitle?.toLowerCase().includes(lower)
        );
        if (targetChat) {
          resolvedChatId = targetChat.id?._serialized || chatId;
          chatDisplayName = targetChat.name || (targetChat as any).formattedTitle || resolvedChatId;
        }
      } catch {
        // Safe get chats search error ignored
      }
    }

    if (!targetChat && !chatId.includes('@')) {
      throw HttpError.notFound(`Chat not found for identifier: "${chatId}"`, 'CHAT_NOT_FOUND');
    }

    logger.info({ chatId: resolvedChatId, chatName: chatDisplayName }, 'Sending single WhatsApp message');

    let sent: any;
    if (targetChat) {
      try {
        sent = await targetChat.sendMessage(message.trim());
      } catch (sendErr: any) {
        logger.warn(
          { error: sendErr?.message, chatId: resolvedChatId },
          'targetChat.sendMessage failed, trying direct client send fallback'
        );
        try {
          sent = await this.client!.sendMessage(resolvedChatId, message.trim());
        } catch (fallbackErr: any) {
          logger.error(
            { error: fallbackErr?.message, chatId: resolvedChatId },
            'WhatsApp message delivery failed completely'
          );
          throw HttpError.internal(
            `Failed to dispatch WhatsApp message: ${fallbackErr?.message || sendErr?.message}`,
            'SEND_FAILED'
          );
        }
      }
    } else {
      try {
        sent = await this.client!.sendMessage(resolvedChatId, message.trim());
      } catch (fallbackErr: any) {
        logger.error(
          { error: fallbackErr?.message, chatId: resolvedChatId },
          'WhatsApp message delivery failed completely'
        );
        throw HttpError.internal(
          `Failed to dispatch WhatsApp message: ${fallbackErr?.message}`,
          'SEND_FAILED'
        );
      }
    }

    // WhatsApp Web multi-device / @lid accounts can return undefined from sendMessage
    // when Msg.get(newMsgKey._serialized) is delayed or indexed differently in browser store.
    // Guard against undefined or differently structured `sent` response.
    const messageId =
      sent?.id?._serialized ||
      (typeof sent?.id === 'string' ? sent.id : sent?.id?.id) ||
      (targetChat as any)?.lastMessage?.id?._serialized ||
      `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const timestamp =
      sent?.timestamp && typeof sent.timestamp === 'number'
        ? new Date(sent.timestamp * 1000)
        : new Date();

    logger.info({ chatId: resolvedChatId, messageId }, 'WhatsApp message sent successfully');

    return {
      messageId,
      timestamp,
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

  /**
   * Determine the most human-readable name for a chat:
   * Prioritizes saved address book contact names and WhatsApp profile pushnames over bare phone numbers.
   */
  private resolveChatDisplayName(chat: Chat): string {
    const raw = chat as any;

    if (chat.isGroup) {
      return chat.name || raw.formattedTitle || 'Unnamed Group';
    }

    const isPhoneLike = (val?: string): boolean => {
      if (!val || typeof val !== 'string') return false;
      const trimmed = val.trim();
      if (!trimmed) return false;
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length >= 7) {
        const stripped = trimmed.replace(/[\d\s+\-()]/g, '');
        return stripped.length === 0;
      }
      return false;
    };

    // 1. Check in-memory contactNameCache first
    const jid = chat.id?._serialized;
    if (jid && this.contactNameCache.has(jid)) {
      const cached = this.contactNameCache.get(jid);
      if (cached && !isPhoneLike(cached)) return cached;
    }

    // 2. Saved contact name from address book (raw.contact or raw._data)
    const contactName = raw.contact?.name || raw._data?.name;
    if (contactName && typeof contactName === 'string' && !isPhoneLike(contactName)) {
      return contactName.trim();
    }

    // 3. Chat name if it represents an actual person name (not bare phone digits)
    if (chat.name && typeof chat.name === 'string' && !isPhoneLike(chat.name)) {
      return chat.name.trim();
    }

    // 4. WhatsApp public profile pushname / notifyName
    const pushName =
      raw.contact?.pushname ||
      raw._data?.notifyName ||
      raw.contact?.shortName ||
      raw.contact?.verifiedName ||
      raw._data?.verifiedName;
    if (pushName && typeof pushName === 'string' && !isPhoneLike(pushName)) {
      return pushName.trim();
    }

    // 5. Formatted title if not purely a phone number
    if (raw.formattedTitle && typeof raw.formattedTitle === 'string' && !isPhoneLike(raw.formattedTitle)) {
      return raw.formattedTitle.trim();
    }

    // 6. Fallback to formatted title or phone number with '+'
    if (chat.name) return chat.name;
    if (raw.formattedTitle) return raw.formattedTitle;
    const phone = chat.id?.user;
    return phone ? `+${phone}` : 'Unnamed Chat';
  }

  /**
   * Asynchronously enrich chat with contact pushname/name from WhatsApp
   */
  private async enrichChatContactName(chat: Chat): Promise<string | undefined> {
    if (chat.isGroup) return undefined;
    const jid = chat.id?._serialized;
    if (!jid) return undefined;

    if (this.contactNameCache.has(jid)) {
      return this.contactNameCache.get(jid);
    }

    try {
      if (typeof (chat as any).getContact === 'function') {
        const contact = await (chat as any).getContact();
        if (contact) {
          const name = contact.name || contact.pushname || contact.shortName || contact.verifiedName;
          if (name && typeof name === 'string' && name.trim()) {
            const digits = name.replace(/\D/g, '');
            const isPhone = digits.length >= 7 && name.replace(/[\d\s+\-()]/g, '').length === 0;
            if (!isPhone) {
              const trimmed = name.trim();
              this.contactNameCache.set(jid, trimmed);
              return trimmed;
            }
          }
        }
      }
    } catch {
      // Ignore lookup errors
    }
    return undefined;
  }

  private mapChatToInfo(chat: Chat): IChatInfo {
    const rawChat = chat as any;
    let phoneNumber: string | undefined;
    if (!chat.isGroup) {
      if (rawChat.contact?.number && !rawChat.contact.number.includes('@')) {
        phoneNumber = rawChat.contact.number;
      } else if (rawChat.contact?.phoneNumber?._serialized) {
        phoneNumber = rawChat.contact.phoneNumber.user;
      } else if (chat.id?.user && !chat.id._serialized?.endsWith('@lid')) {
        phoneNumber = chat.id.user;
      }
    }
    const name = this.resolveChatDisplayName(chat);
    return {
      id: chat.id?._serialized || (chat as any).id,
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
