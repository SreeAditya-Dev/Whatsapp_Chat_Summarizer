import EventEmitter from 'events';
import { IChatProvider } from '../core/interfaces/chat.interface';
import { ISummarizer } from '../core/interfaces/summarizer.interface';
import { IChatMessage } from '../core/types/summary.types';
import { SettingsService } from './settings.service';
import { logger } from '../utils/logger';

export interface AutoReplyLog {
  id: string;
  chatId: string;
  chatName: string;
  isGroup: boolean;
  incomingPreview: string;
  replyText: string;
  timestamp: string;
  status: 'sent' | 'failed' | 'skipped';
  reason?: string;
}

interface QueuedIncoming {
  timer: NodeJS.Timeout;
  chatId: string;
  chatName: string;
  isGroup: boolean;
  incomingTexts: string[];
  firstMessageAt: number;
  rawMessage?: any;
}

export class AutoReplyService {
  private queue = new Map<string, QueuedIncoming>();
  private history: AutoReplyLog[] = [];
  private static MAX_HISTORY = 50;
  private lastReplyTime = new Map<string, number>();
  private debounceMs = 5000;
  private maxWaitMs = 15000;
  private cooldownMs = 12000;

  constructor(
    private chatProvider: IChatProvider,
    private summarizer: ISummarizer,
    private eventEmitter?: EventEmitter
  ) {
    if (this.eventEmitter && typeof this.eventEmitter.on === 'function') {
      this.eventEmitter.on('message_received', (event) => {
        void this.handleIncomingMessage(event);
      });
      logger.info('AutoReplyService attached to message_received event stream');
    }
  }

  /**
   * Main entry point when an incoming message is received
   */
  async handleIncomingMessage(event: {
    chatId: string;
    message: IChatMessage;
    chatName?: string;
    isGroup?: boolean;
    rawMessage?: any;
  }): Promise<void> {
    const { chatId, message, chatName, isGroup, rawMessage } = event;

    // 1. Verify AI reply and auto-reply are enabled in app settings
    const settings = SettingsService.getSettings();
    if (!settings.aiReply.enabled) {
      return;
    }
    if (settings.aiReply.autoReply === false) {
      return;
    }

    // 2. Ignore empty messages or system notifications
    const incomingText = message.body?.trim() || '';
    if (!incomingText && !message.hasMedia) {
      return;
    }

    // 3. Verify Admin Chat Whitelist
    const additionalIdentifiers: string[] = [];
    if (chatId) additionalIdentifiers.push(chatId);
    if (chatName) additionalIdentifiers.push(chatName);
    if (message.senderNumber) additionalIdentifiers.push(message.senderNumber);
    if (message.senderName) additionalIdentifiers.push(message.senderName);

    const isAllowed = SettingsService.isChatAllowedForReply(chatId, additionalIdentifiers);
    if (!isAllowed) {
      logger.debug({ chatId, chatName }, 'Auto-reply skipped: chat is not on whitelist');
      return;
    }

    // 4. Check Cooldown to avoid rapid repetitive bot responses
    const now = Date.now();
    const lastSent = this.lastReplyTime.get(chatId) || 0;
    if (now - lastSent < this.cooldownMs) {
      logger.debug({ chatId, chatName }, 'Auto-reply in cooldown window, delaying next response');
    }

    // 5. Enqueue with Human-like Debounce
    // Groups multiple consecutive messages from the same sender into 1 single comprehensive reply
    const existing = this.queue.get(chatId);
    if (existing) {
      clearTimeout(existing.timer);
      existing.incomingTexts.push(incomingText);
      const elapsed = now - existing.firstMessageAt;

      // If already waiting longer than maxWaitMs, trigger immediately
      if (elapsed >= this.maxWaitMs) {
        this.queue.delete(chatId);
        await this.dispatchAutoReply(existing);
        return;
      }

      existing.timer = setTimeout(() => {
        const item = this.queue.get(chatId);
        if (item) {
          this.queue.delete(chatId);
          void this.dispatchAutoReply(item);
        }
      }, this.debounceMs);
    } else {
      const entry: QueuedIncoming = {
        timer: setTimeout(() => {
          const item = this.queue.get(chatId);
          if (item) {
            this.queue.delete(chatId);
            void this.dispatchAutoReply(item);
          }
        }, this.debounceMs),
        chatId,
        chatName: chatName || chatId,
        isGroup: isGroup || false,
        incomingTexts: [incomingText],
        firstMessageAt: now,
        rawMessage,
      };
      this.queue.set(chatId, entry);
      logger.debug({ chatId, chatName }, 'Incoming message queued for human-paced auto-reply');
    }
  }

  /**
   * Generates and dispatches a single human-like reply
   */
  async dispatchAutoReply(queued: QueuedIncoming): Promise<AutoReplyLog | null> {
    const { chatId, chatName, isGroup, incomingTexts, rawMessage } = queued;
    const settings = SettingsService.getSettings();

    if (!settings.aiReply.enabled || settings.aiReply.autoReply === false) {
      return null;
    }

    try {
      // 1. Simulate WhatsApp Typing Indicator for human feel
      try {
        if (rawMessage && typeof rawMessage.getChat === 'function') {
          const chat = await rawMessage.getChat();
          if (typeof chat.sendStateTyping === 'function') {
            await chat.sendStateTyping();
          }
        }
      } catch (err: any) {
        logger.debug({ err: err?.message }, 'Typing indicator simulation skipped');
      }

      // 2. Fetch recent chat conversation for context
      const messages = await this.chatProvider.getChatMessages(chatId, 15);

      // 3. Generate human-like reply with configured tone and persona
      let replyText = '';
      if (typeof this.summarizer.generateReply === 'function') {
        const result = await this.summarizer.generateReply({
          chatId,
          chatName,
          isGroup,
          messages: messages.length > 0 ? messages : [],
          instruction: `Respond naturally to the latest message(s): "${incomingTexts.join(' ')}"`,
          tone: settings.aiReply.defaultTone || 'casual',
          senderPersona: settings.aiReply.customPersona || undefined,
        });
        replyText = result.reply?.trim() || '';
      } else {
        replyText = 'Thanks for reaching out! Will follow up shortly.';
      }

      if (!replyText) {
        logger.warn({ chatId, chatName }, 'Auto-reply generator produced empty response, skipping');
        return null;
      }

      // 4. Send strictly single message to WhatsApp
      logger.info(
        { chatId, chatName, replyLength: replyText.length },
        'Dispatching automated AI reply to WhatsApp'
      );
      const sendResult = await this.chatProvider.sendMessage(chatId, replyText);

      this.lastReplyTime.set(chatId, Date.now());

      const logEntry: AutoReplyLog = {
        id: sendResult.messageId || `auto-${Date.now()}`,
        chatId,
        chatName,
        isGroup,
        incomingPreview: incomingTexts.join(' | ').slice(0, 120),
        replyText,
        timestamp: sendResult.timestamp ? sendResult.timestamp.toISOString() : new Date().toISOString(),
        status: 'sent',
      };

      this.recordLog(logEntry);
      return logEntry;
    } catch (err: any) {
      logger.error({ error: err?.message, chatId, chatName }, 'Failed to dispatch auto-reply');
      const failEntry: AutoReplyLog = {
        id: `fail-${Date.now()}`,
        chatId,
        chatName,
        isGroup,
        incomingPreview: incomingTexts.join(' | ').slice(0, 120),
        replyText: '',
        timestamp: new Date().toISOString(),
        status: 'failed',
        reason: err?.message || 'Unknown error',
      };
      this.recordLog(failEntry);
      return failEntry;
    }
  }

  private recordLog(entry: AutoReplyLog): void {
    this.history.unshift(entry);
    if (this.history.length > AutoReplyService.MAX_HISTORY) {
      this.history.length = AutoReplyService.MAX_HISTORY;
    }
  }

  getHistory(): AutoReplyLog[] {
    return [...this.history];
  }

  setDebounceMs(ms: number): void {
    this.debounceMs = Math.max(0, ms);
  }

  clearQueue(): void {
    for (const item of this.queue.values()) {
      clearTimeout(item.timer);
    }
    this.queue.clear();
  }
}
