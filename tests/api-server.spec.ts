import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createExpressApp } from '../src/api/server';
import { IChatProvider, ChatProviderStatus, ChatFilterType } from '../src/core/interfaces/chat.interface';
import { ISummarizer, SummarizeOptions } from '../src/core/interfaces/summarizer.interface';
import { PaginationParams, PaginatedResult } from '../src/core/types/api.types';
import { IChatInfo, IChatMessage, IChatSummary } from '../src/core/types/summary.types';
import { ApiResponseHelper } from '../src/utils/api-response';
import { HttpError } from '../src/core/errors/http-error';

class MockChatProvider implements IChatProvider {
  public customStatus: ChatProviderStatus = {
    state: 'READY',
    pushname: 'TestUser',
    phoneNumber: '1234567890',
  };

  private chats: IChatInfo[] = [
    { id: 'chat-1', name: 'Engineering Team', isGroup: true, unreadCount: 15 },
    { id: 'chat-2', name: 'Product Design', isGroup: true, unreadCount: 0 },
    { id: 'chat-3', name: 'Sarah Connor', isGroup: false, unreadCount: 4, phoneNumber: '919876543210' },
    { id: 'chat-4', name: 'DevOps Alerts', isGroup: true, unreadCount: 230 },
    { id: 'chat-5', name: 'Praveen Kumar', isGroup: false, unreadCount: 0, phoneNumber: '919092345559' },
  ];

  private ensureReady(): void {
    if (this.customStatus.state !== 'READY') {
      throw HttpError.serviceUnavailable('WhatsApp client is not ready. Authenticate first.', 'WHATSAPP_NOT_READY');
    }
  }

  async initialize(): Promise<void> {}

  getStatus(): ChatProviderStatus {
    return this.customStatus;
  }

  async getUnreadChats(pagination?: PaginationParams): Promise<PaginatedResult<IChatInfo>> {
    this.ensureReady();
    const unread = this.chats.filter((c) => c.unreadCount > 0);
    return ApiResponseHelper.sliceArrayWithPagination(unread, pagination?.page, pagination?.limit);
  }

  async getRecentChats(pagination?: PaginationParams, filter: ChatFilterType = 'all'): Promise<PaginatedResult<IChatInfo>> {
    this.ensureReady();
    let filtered = this.chats;
    if (filter === 'groups') filtered = this.chats.filter((c) => c.isGroup);
    if (filter === 'direct') filtered = this.chats.filter((c) => !c.isGroup);
    return ApiResponseHelper.sliceArrayWithPagination(filtered, pagination?.page, pagination?.limit);
  }

  async getChatById(chatId: string): Promise<IChatInfo | null> {
    this.ensureReady();
    const qDigits = chatId.replace(/\D/g, '');
    return (
      this.chats.find((c) => {
        if (c.id === chatId || c.name.toLowerCase().includes(chatId.toLowerCase())) return true;
        if (qDigits.length >= 5 && c.phoneNumber) {
          const pDigits = c.phoneNumber.replace(/\D/g, '');
          if (
            pDigits.length >= 5 &&
            (pDigits.includes(qDigits) ||
              qDigits.includes(pDigits) ||
              pDigits.endsWith(qDigits) ||
              qDigits.endsWith(pDigits))
          ) {
            return true;
          }
        }
        return false;
      }) || null
    );
  }

  async searchChats(query: string, limit = 20): Promise<IChatInfo[]> {
    this.ensureReady();
    const q = query.toLowerCase();
    const qDigits = query.replace(/\D/g, '');
    return this.chats
      .filter((c) => {
        if (c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) return true;
        if (c.phoneNumber && c.phoneNumber.includes(q)) return true;
        if (qDigits.length >= 4 && c.phoneNumber) {
          const pDigits = c.phoneNumber.replace(/\D/g, '');
          if (
            pDigits.length >= 4 &&
            (pDigits.includes(qDigits) ||
              qDigits.includes(pDigits) ||
              pDigits.endsWith(qDigits) ||
              qDigits.endsWith(pDigits))
          ) {
            return true;
          }
        }
        return false;
      })
      .slice(0, limit);
  }

  async getChatMessages(chatId: string, limit = 100): Promise<IChatMessage[]> {
    this.ensureReady();
    return [
      {
        id: 'msg-1',
        senderName: 'Alice',
        timestamp: new Date('2026-09-10T10:00:00Z'),
        body: 'Can everyone review the PR?',
        isQuoted: false,
        hasMedia: false,
      },
      {
        id: 'msg-2',
        senderName: 'Bob',
        timestamp: new Date('2026-09-10T10:02:00Z'),
        body: 'Reviewed and approved!',
        isQuoted: true,
        quotedMessage: { senderName: 'Alice', body: 'Can everyone review the PR?' },
        hasMedia: false,
      },
    ];
  }

  async sendMessage(chatId: string, message: string): Promise<{ messageId: string; timestamp: Date }> {
    this.ensureReady();
    if (!message.trim()) {
      throw HttpError.badRequest('Message content cannot be empty', 'INVALID_MESSAGE');
    }
    return { messageId: 'msg-test-123', timestamp: new Date() };
  }

  async disconnect(): Promise<void> {}
}

class MockSummarizer implements ISummarizer {
  async summarize(messages: IChatMessage[], options: SummarizeOptions): Promise<IChatSummary> {
    return {
      chatId: options.chatId,
      chatName: options.chatName,
      isGroup: options.isGroup,
      totalMessagesAnalyzed: messages.length,
      unreadCount: options.unreadCount || 0,
      timeRange: { start: '2026-09-10 10:00', end: '2026-09-10 10:02' },
      tldr: 'PR was reviewed and approved.',
      keyTopics: ['PR Review'],
      actionItems: [],
      decisions: ['PR approved'],
      importantLinksAndDates: [],
      urgencyLevel: 'LOW',
      rawSummaryMarkdown: '# Summary\nPR approved.',
      generatedAt: new Date().toISOString(),
    };
  }
}

describe('Express REST API (v1)', () => {
  let app: Express;
  let mockProvider: MockChatProvider;
  let mockSummarizer: MockSummarizer;

  beforeEach(() => {
    mockProvider = new MockChatProvider();
    mockSummarizer = new MockSummarizer();
    app = createExpressApp(mockProvider, mockSummarizer);
  });

  it('GET /api/v1/health should return 200 with standard response envelope', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.services.whatsapp.connected).toBe(true);
  });

  it('GET /api/v1/whatsapp/status should return provider status', async () => {
    const res = await request(app).get('/api/v1/whatsapp/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('READY');
    expect(res.body.data.pushname).toBe('TestUser');
  });

  it('GET /api/v1/chats should support pagination (page=1, limit=2)', async () => {
    const res = await request(app).get('/api/v1/chats?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.pagination.total).toBe(5);
    expect(res.body.pagination.totalPages).toBe(3);
    expect(res.body.pagination.hasNextPage).toBe(true);
  });

  it('GET /api/v1/chats/unread should return only chats with unread messages', async () => {
    const res = await request(app).get('/api/v1/chats/unread');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(3); // 3 chats have unreadCount > 0
    expect(res.body.data.every((c: any) => c.unreadCount > 0)).toBe(true);
  });

  it('GET /api/v1/chats/:chatId should return specific chat or 404', async () => {
    const okRes = await request(app).get('/api/v1/chats/chat-1');
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.name).toBe('Engineering Team');

    const notFoundRes = await request(app).get('/api/v1/chats/non-existent-id');
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.success).toBe(false);
    expect(notFoundRes.body.error.code).toBe('CHAT_NOT_FOUND');
  });

  it('POST /api/v1/summarize should validate request body', async () => {
    // Missing chatId
    const badRes = await request(app).post('/api/v1/summarize').send({});
    expect(badRes.status).toBe(400);
    expect(badRes.body.success).toBe(false);
    expect(badRes.body.error.code).toBe('VALIDATION_ERROR');

    // Valid request
    const goodRes = await request(app).post('/api/v1/summarize').send({
      chatId: 'chat-1',
      messageLimit: 50,
    });
    expect(goodRes.status).toBe(200);
    expect(goodRes.body.success).toBe(true);
    expect(goodRes.body.data.tldr).toBe('PR was reviewed and approved.');
    expect(goodRes.body.data.chatName).toBe('Engineering Team');
  });

  it('GET /qr should return HTML status or QR page', async () => {
    const res = await request(app).get('/qr');
    expect(res.status).toBe(200);
    expect(res.text).toContain('WhatsApp is Ready!');
  });

  it('GET /qr should safely escape pushname against Stored XSS', async () => {
    mockProvider.customStatus = {
      state: 'READY',
      pushname: '<script>alert("XSS")</script>',
      phoneNumber: '1234567890',
    };

    const res = await request(app).get('/qr');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('<script>alert("XSS")</script>');
    expect(res.text).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
  });

  it('GET /api/v1/chats should reject invalid query parameters with 400', async () => {
    // Invalid page <= 0
    const badPageRes = await request(app).get('/api/v1/chats?page=0');
    expect(badPageRes.status).toBe(400);
    expect(badPageRes.body.success).toBe(false);
    expect(badPageRes.body.error.code).toBe('VALIDATION_ERROR');

    // Invalid filter type
    const badFilterRes = await request(app).get('/api/v1/chats?filter=unknown_filter');
    expect(badFilterRes.status).toBe(400);
    expect(badFilterRes.body.success).toBe(false);
    expect(badFilterRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/chats and POST /api/v1/summarize should return 503 when WhatsApp is not ready', async () => {
    mockProvider.customStatus = {
      state: 'INITIALIZING',
      pushname: undefined,
      phoneNumber: undefined,
    };

    const chatsRes = await request(app).get('/api/v1/chats');
    expect(chatsRes.status).toBe(503);
    expect(chatsRes.body.success).toBe(false);
    expect(chatsRes.body.error.code).toBe('WHATSAPP_NOT_READY');

    const sumRes = await request(app).post('/api/v1/summarize').send({ chatId: 'chat-1' });
    expect(sumRes.status).toBe(503);
    expect(sumRes.body.success).toBe(false);
    expect(sumRes.body.error.code).toBe('WHATSAPP_NOT_READY');
  });

  it('GET /api/v1/settings and PUT /api/v1/settings should retrieve and update configuration', async () => {
    const getRes = await request(app).get('/api/v1/settings');
    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.summary).toBeDefined();
    expect(getRes.body.data.aiReply).toBeDefined();

    const putRes = await request(app)
      .put('/api/v1/settings')
      .send({
        summary: { defaultDepth: 'detailed', defaultMessageLimit: 120 },
        aiReply: { defaultTone: 'friendly', whitelistMode: 'selected', allowedChatIds: ['chat-1'] },
      });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data.summary.defaultDepth).toBe('detailed');
    expect(putRes.body.data.summary.defaultMessageLimit).toBe(120);
    expect(putRes.body.data.aiReply.allowedChatIds).toContain('chat-1');
  });

  it('POST /api/v1/reply/draft and /api/v1/reply/send should enforce whitelist access and dispatch single messages', async () => {
    // Whitelist chat-1 only
    await request(app)
      .put('/api/v1/settings')
      .send({
        aiReply: { enabled: true, whitelistMode: 'selected', allowedChatIds: ['chat-1'] },
      });

    // Drafting for whitelisted chat-1 should succeed
    const draftRes = await request(app)
      .post('/api/v1/reply/draft')
      .send({ chatId: 'chat-1', tone: 'casual' });
    expect(draftRes.status).toBe(200);
    expect(draftRes.body.success).toBe(true);
    expect(draftRes.body.data.reply).toBeDefined();

    // Drafting for non-whitelisted chat-3 should be forbidden (403)
    const blockedDraftRes = await request(app)
      .post('/api/v1/reply/draft')
      .send({ chatId: 'chat-3', tone: 'casual' });
    expect(blockedDraftRes.status).toBe(403);
    expect(blockedDraftRes.body.error.code).toBe('CHAT_NOT_ALLOWED');

    // Sending for whitelisted chat-1 should deliver single message
    const sendRes = await request(app)
      .post('/api/v1/reply/send')
      .send({ chatId: 'chat-1', message: 'Hello team!' });
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.success).toBe(true);
    expect(sendRes.body.data.delivered).toBe(true);
    expect(sendRes.body.data.messageId).toBe('msg-test-123');

    // Sending to non-whitelisted chat-3 should be rejected with 403
    const blockedSendRes = await request(app)
      .post('/api/v1/reply/send')
      .send({ chatId: 'chat-3', message: 'Hello' });
    expect(blockedSendRes.status).toBe(403);
    expect(blockedSendRes.body.error.code).toBe('CHAT_NOT_ALLOWED');
  });

  it('POST /api/v1/reply/draft should allow replies when chat is whitelisted by formatted phone number', async () => {
    // Whitelist Sarah Connor by her formatted phone number (+91 98765 43210)
    await request(app)
      .put('/api/v1/settings')
      .send({
        aiReply: { enabled: true, whitelistMode: 'selected', allowedChatIds: ['+91 98765 43210'] },
      });

    // Drafting for chat-3 (which has phoneNumber '919876543210') should now be accepted
    const draftRes = await request(app)
      .post('/api/v1/reply/draft')
      .send({ chatId: 'chat-3', tone: 'friendly' });
    expect(draftRes.status).toBe(200);
    expect(draftRes.body.success).toBe(true);
    expect(draftRes.body.data.reply).toBeDefined();
  });

  it('POST /api/v1/summarize should support mode parameter (compact, brief, detailed)', async () => {
    const res = await request(app)
      .post('/api/v1/summarize')
      .send({ chatId: 'chat-1', mode: 'compact' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tldr).toBeDefined();
  });

  it('GET /api/v1/chats/search should return person name when searching by number 90923 45559', async () => {
    // Search by user query with spaces "90923 45559"
    const res = await request(app).get('/api/v1/chats/search?q=90923%2045559');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toBe('Praveen Kumar');
    expect(res.body.data[0].phoneNumber).toBe('919092345559');

    // Also verify GET /api/v1/chats/9092345559 resolves by number
    const byIdRes = await request(app).get('/api/v1/chats/9092345559');
    expect(byIdRes.status).toBe(200);
    expect(byIdRes.body.data.name).toBe('Praveen Kumar');
  });
});

