import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../../../core/errors/http-error';
import { SettingsService } from '../../../services/settings.service';
import { ApiResponseHelper } from '../../../utils/api-response';
import { ISummarizer } from '../../../core/interfaces/summarizer.interface';

const faqCategorySchema = z.enum(['General', 'Pricing', 'Services', 'Timelines', 'Policy']);

const updateBusinessKBSchema = z.object({
  enabled: z.boolean().optional(),
  profile: z
    .object({
      businessName: z.string().max(100).optional(),
      industry: z.string().max(100).optional(),
      tagline: z.string().max(200).optional(),
      operatingHours: z.string().max(200).optional(),
      locationOrAddress: z.string().max(200).optional(),
      contactEmail: z.string().max(100).optional(),
      paymentOrBookingLink: z.string().max(300).optional(),
    })
    .optional(),
  customGuidelines: z.string().max(1000).optional(),
  fallbackMessage: z.string().max(500).optional(),
  additionalNotes: z.string().max(10000).optional(),
});

const createFAQSchema = z.object({
  question: z.string().min(2, 'Question must be at least 2 characters').max(300),
  answer: z.string().min(2, 'Answer must be at least 2 characters').max(1500),
  category: faqCategorySchema.default('General'),
  enabled: z.boolean().default(true),
});

const updateFAQSchema = z.object({
  question: z.string().min(2).max(300).optional(),
  answer: z.string().min(2).max(1500).optional(),
  category: faqCategorySchema.optional(),
  enabled: z.boolean().optional(),
});

const testAnswerSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty').max(500),
  tone: z.enum(['casual', 'friendly', 'professional', 'concise']).default('professional'),
});

export function createBusinessKBRouter(summarizer?: ISummarizer): Router {
  const router = Router();

  /**
   * GET /api/v1/business-kb
   * Retrieve current Business Knowledge Base configuration
   */
  router.get('/', (_req: Request, res: Response) => {
    const kb = SettingsService.getBusinessKB();
    res.status(200).json(ApiResponseHelper.success(kb));
  });

  /**
   * PUT /api/v1/business-kb
   * Update profile, guidelines, catalog notes, or enable state
   */
  router.put('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateBusinessKBSchema.safeParse(req.body);
      if (!parsed.success) {
        throw HttpError.badRequest(
          'Validation failed for business knowledge base update',
          'VALIDATION_ERROR',
          parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        );
      }

      const updated = SettingsService.updateBusinessKB(parsed.data as any);
      res.status(200).json(ApiResponseHelper.success(updated));
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/business-kb/faqs
   * Add a new FAQ entry
   */
  router.post('/faqs', (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createFAQSchema.safeParse(req.body);
      if (!parsed.success) {
        throw HttpError.badRequest(
          'Validation failed for FAQ creation',
          'VALIDATION_ERROR',
          parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        );
      }

      const created = SettingsService.addFAQ(parsed.data);
      res.status(201).json(ApiResponseHelper.success(created));
    } catch (err) {
      next(err);
    }
  });

  /**
   * PUT /api/v1/business-kb/faqs/:id
   * Update an existing FAQ entry
   */
  router.put('/faqs/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parsed = updateFAQSchema.safeParse(req.body);
      if (!parsed.success) {
        throw HttpError.badRequest(
          'Validation failed for FAQ update',
          'VALIDATION_ERROR',
          parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        );
      }

      const updated = SettingsService.updateFAQ(id, parsed.data);
      if (!updated) {
        throw HttpError.notFound(`FAQ item with ID "${id}" was not found`);
      }

      res.status(200).json(ApiResponseHelper.success(updated));
    } catch (err) {
      next(err);
    }
  });

  /**
   * DELETE /api/v1/business-kb/faqs/:id
   * Delete an existing FAQ entry
   */
  router.delete('/faqs/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const deleted = SettingsService.deleteFAQ(id);
      if (!deleted) {
        throw HttpError.notFound(`FAQ item with ID "${id}" was not found`);
      }

      res.status(200).json(ApiResponseHelper.success({ id, deleted: true }));
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/business-kb/test-answer
   * Interactive Sandbox: Test how AI answers a customer question with current KB
   */
  router.post('/test-answer', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = testAnswerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw HttpError.badRequest(
          'Validation failed for test question',
          'VALIDATION_ERROR',
          parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        );
      }

      const kb = SettingsService.getBusinessKB();
      const { question, tone } = parsed.data;

      if (!summarizer) {
        // Mock fallback if summarizer is not provided in test environment
        const match = kb.faqs.find((f) => f.enabled && f.question.toLowerCase().includes(question.toLowerCase()));
        const answer = match ? match.answer : kb.fallbackMessage;
        return res.status(200).json(
          ApiResponseHelper.success({
            question,
            answer,
            source: match ? 'faq_match' : 'fallback',
            tone,
          })
        );
      }

      // Format customer inquiry as a virtual chat message to test AI reply with KB guardrails
      const answer = await (summarizer as any).generateBusinessReply?.(question, tone, kb) ??
        await summarizer.generateReply(
          [
            {
              id: 'test-inquiry',
              senderName: 'Customer',
              timestamp: new Date(),
              body: question,
              isQuoted: false,
              hasMedia: false,
            },
          ],
          {
            chatName: kb.profile.businessName || 'Customer Inquiry',
            isGroup: false,
            tone,
            businessKB: kb,
          }
        );

      res.status(200).json(
        ApiResponseHelper.success({
          question,
          answer,
          tone,
          businessName: kb.profile.businessName || 'Business Assistant',
        })
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}
