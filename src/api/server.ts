import express, { Express, Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { IChatProvider } from '../core/interfaces/chat.interface';
import { ISummarizer } from '../core/interfaces/summarizer.interface';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { apiKeyAuth } from './middleware/auth.middleware';
import { createHealthRouter } from './routes/v1/health.route';
import { createWhatsAppRouter } from './routes/v1/whatsapp.route';
import { createChatsRouter } from './routes/v1/chats.route';
import { createSummaryRouter } from './routes/v1/summary.route';
import { createReplyRouter } from './routes/v1/reply.route';
import { createSettingsRouter } from './routes/v1/settings.route';
import { createQrPageRouter } from './routes/qr-page.route';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export function createExpressApp(
  chatProvider: IChatProvider,
  summarizer: ISummarizer
): Express {
  const app = express();

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows inline base64 QR code image rendering
    })
  );

  // Cross-Origin Resource Sharing
  app.use(cors());

  // JSON Body Parser
  app.use(express.json());

  // Request Logging
  app.use((req, _res, next) => {
    logger.debug({ method: req.method, url: req.url }, 'Incoming HTTP Request');
    next();
  });

  // Rate Limiting
  const isDev = env.NODE_ENV !== 'production';

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDev ? 10000 : 1000, // relaxed for dashboard polling
    skip: (req) => isDev || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' },
      timestamp: new Date().toISOString(),
    },
  });

  const summarizeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: isDev ? 60 : 15, // max summarize requests per minute to prevent AI cost exhaustion
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many summarization requests. Please wait a minute.' },
      timestamp: new Date().toISOString(),
    },
  });

  const qrLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isDev ? 500 : 60,
    skip: () => isDev,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Visual QR Page & Root Health (Public for local pairing)
  app.use(qrLimiter, createQrPageRouter(chatProvider));
  app.use('/health', createHealthRouter(chatProvider));

  // Version 1 API Router
  const v1Router = Router();
  v1Router.use(generalLimiter);

  // Health endpoint (public)
  v1Router.use('/health', createHealthRouter(chatProvider));

  // WhatsApp endpoints (protected by optional API key)
  v1Router.use('/whatsapp', apiKeyAuth, createWhatsAppRouter(chatProvider));

  // Chats endpoints (protected by optional API key)
  v1Router.use('/chats', apiKeyAuth, createChatsRouter(chatProvider));

  // Summarize endpoint (rate limited + protected by optional API key)
  v1Router.use('/summarize', summarizeLimiter, apiKeyAuth, createSummaryRouter(chatProvider, summarizer));

  // AI Reply endpoints (draft and send)
  v1Router.use('/reply', summarizeLimiter, apiKeyAuth, createReplyRouter(chatProvider, summarizer));

  // Settings endpoints (get and update preferences)
  v1Router.use('/settings', apiKeyAuth, createSettingsRouter());

  // Mount v1 router under /api/v1
  app.use('/api/v1', v1Router);

  // Serve the React frontend (frontend/dist) when built — same-origin, no CORS needed.
  const frontendDist = path.resolve(process.cwd(), 'frontend', 'dist');
  if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist, { maxAge: '1h', index: false }));
    // SPA fallback: anything that isn't /api, /health or /qr renders the dashboard.
    app.get(/^\/(?!api\/|health|qr(?:\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  // Fallback 404 & Global Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
