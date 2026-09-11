import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../src/api/server';
import { SettingsService } from '../src/services/settings.service';
import { IChatProvider } from '../src/core/interfaces/chat-provider.interface';
import { ISummarizer } from '../src/core/interfaces/summarizer.interface';

describe('Business Knowledge Base API', () => {
  let app: any;

  const mockChatProvider: Partial<IChatProvider> = {
    getStatus: () => ({
      state: 'READY',
      pushname: 'Test Business',
      phoneNumber: '1234567890',
    }),
  };

  const mockSummarizer: Partial<ISummarizer> = {
    generateReply: async () => ({ reply: 'Test generated business reply', suggestions: ['Alt 1', 'Alt 2'] }),
  };

  beforeEach(() => {
    // Reset to default
    SettingsService.updateSettings({
      businessKB: {
        enabled: false,
        profile: {
          businessName: 'Apex Web Studio',
          industry: 'Design',
          tagline: 'Crafting websites',
          operatingHours: '9am - 5pm',
          locationOrAddress: 'Bangalore',
          contactEmail: 'hi@apex.dev',
          paymentOrBookingLink: 'https://apex.dev/book',
        },
        faqs: [
          {
            id: 'faq-1',
            question: 'What is your price?',
            answer: 'Starting at $500',
            category: 'Pricing',
            enabled: true,
            createdAt: new Date().toISOString(),
          },
        ],
        customGuidelines: 'Be polite',
        fallbackMessage: 'I will notify the owner',
        additionalNotes: 'No refunds after 7 days',
      },
    });

    app = createExpressApp(mockChatProvider as any, mockSummarizer as any);
  });

  it('GET /api/v1/business-kb should return the business knowledge base', async () => {
    const res = await request(app).get('/api/v1/business-kb');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.businessName).toBe('Apex Web Studio');
    expect(res.body.data.faqs).toHaveLength(1);
    expect(res.body.data.fallbackMessage).toBe('I will notify the owner');
  });

  it('PUT /api/v1/business-kb should update profile and settings', async () => {
    const res = await request(app)
      .put('/api/v1/business-kb')
      .send({
        enabled: true,
        profile: {
          businessName: 'Apex Digital Labs',
        },
        fallbackMessage: 'Owner will contact you shortly.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.profile.businessName).toBe('Apex Digital Labs');
    expect(res.body.data.fallbackMessage).toBe('Owner will contact you shortly.');
  });

  it('POST /api/v1/business-kb/faqs should add a new FAQ item', async () => {
    const res = await request(app)
      .post('/api/v1/business-kb/faqs')
      .send({
        question: 'Do you offer mobile apps?',
        answer: 'Yes, we build React Native iOS and Android apps.',
        category: 'Services',
        enabled: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toMatch(/^faq-/);
    expect(res.body.data.question).toBe('Do you offer mobile apps?');

    const getRes = await request(app).get('/api/v1/business-kb');
    expect(getRes.body.data.faqs).toHaveLength(2);
  });

  it('PUT /api/v1/business-kb/faqs/:id should update existing FAQ', async () => {
    const res = await request(app)
      .put('/api/v1/business-kb/faqs/faq-1')
      .send({
        answer: 'Starting at $750 for custom designs',
        enabled: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toBe('Starting at $750 for custom designs');
    expect(res.body.data.enabled).toBe(false);
  });

  it('DELETE /api/v1/business-kb/faqs/:id should delete an FAQ', async () => {
    const res = await request(app).delete('/api/v1/business-kb/faqs/faq-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const getRes = await request(app).get('/api/v1/business-kb');
    expect(getRes.body.data.faqs).toHaveLength(0);
  });

  it('POST /api/v1/business-kb/test-answer should return simulated AI answer in sandbox', async () => {
    const res = await request(app)
      .post('/api/v1/business-kb/test-answer')
      .send({
        question: 'What are your rates?',
        tone: 'professional',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toBe('Test generated business reply');
    expect(res.body.data.question).toBe('What are your rates?');
  });
});
