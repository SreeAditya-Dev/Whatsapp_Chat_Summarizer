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
    { id: 'chat-3', name: 'Sarah Connor', isGroup: false, unreadCount: 4 },
    { id: 'chat-4', name: 'DevOps Alerts', isGroup: true, unreadCount: 230 },
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
    return this.chats.find((c) => c.id === chatId || c.name === chatId) || null;
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
    expect(res.body.pagination.total).toBe(4);
    expect(res.body.pagination.totalPages).toBe(2);
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
});

