import express, { Express, Router } from 'express';
import cors from 'cors';
import { IChatProvider } from '../core/interfaces/chat.interface';
import { ISummarizer } from '../core/interfaces/summarizer.interface';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { createHealthRouter } from './routes/v1/health.route';
import { createWhatsAppRouter } from './routes/v1/whatsapp.route';
import { createChatsRouter } from './routes/v1/chats.route';
import { createSummaryRouter } from './routes/v1/summary.route';
import { createQrPageRouter } from './routes/qr-page.route';
import { logger } from '../utils/logger';

export function createExpressApp(
  chatProvider: IChatProvider,
  summarizer: ISummarizer
): Express {
  const app = express();

  // Core Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger middleware
  app.use((req, _res, next) => {
    logger.debug({ method: req.method, url: req.url }, 'Incoming HTTP Request');
    next();
  });

  // Visual QR Page & Root Health
  app.use(createQrPageRouter(chatProvider));
  app.use('/health', createHealthRouter(chatProvider));

  // Version 1 API Router
  const v1Router = Router();
  v1Router.use('/health', createHealthRouter(chatProvider));
  v1Router.use('/whatsapp', createWhatsAppRouter(chatProvider));
  v1Router.use('/chats', createChatsRouter(chatProvider));
  v1Router.use('/summarize', createSummaryRouter(chatProvider, summarizer));

  // Mount v1 router under /api/v1
  app.use('/api/v1', v1Router);

  // Fallback 404 & Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
