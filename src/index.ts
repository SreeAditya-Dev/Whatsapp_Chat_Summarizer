import http from 'http';
import { env } from './config/env';
import { WhatsAppService } from './services/whatsapp.service';
import { MistralSummarizerService } from './services/mistral.service';
import { TelegramBotService } from './services/telegram.service';
import { createExpressApp } from './api/server';
import { logger } from './utils/logger';

async function bootstrap() {
  logger.info(
    { nodeEnv: env.NODE_ENV, port: env.PORT, mistralModel: env.MISTRAL_MODEL },
    'Starting WhatsApp Chat Summarizer service...'
  );

  // 1. Initialize Domain Services
  const whatsappService = new WhatsAppService();
  const summarizerService = new MistralSummarizerService();

  // 2. Initialize Telegram Bot
  let telegramBot: TelegramBotService | null = null;
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here') {
    try {
      telegramBot = new TelegramBotService(whatsappService, summarizerService);
      await telegramBot.start();
      logger.info('Telegram bot service started successfully.');
    } catch (err: any) {
      logger.error({ error: err.message }, 'Failed to start Telegram bot service');
    }
  } else {
    logger.warn('TELEGRAM_BOT_TOKEN is not set. Telegram bot interaction is disabled.');
  }

  // 3. Initialize Express HTTP Server
  const app = createExpressApp(whatsappService, summarizerService);
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    logger.info(`REST API Server listening on http://localhost:${env.PORT}`);
    logger.info(`Scan WhatsApp QR in browser at: http://localhost:${env.PORT}/qr`);
    logger.info(`Health check available at: http://localhost:${env.PORT}/api/v1/health`);
  });

  // 4. Start WhatsApp Client
  try {
    logger.info('Initializing WhatsApp Web client...');
    whatsappService.initialize().catch((err) => {
      logger.error({ error: err.message }, 'Error in WhatsApp client background initialization');
    });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to initialize WhatsApp Web client');
  }

  // 5. Handle Graceful Shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal. Cleaning up resources...');

    if (telegramBot) {
      try {
        await telegramBot.stop();
      } catch (e: any) {
        logger.error({ error: e.message }, 'Error stopping Telegram bot');
      }
    }

    try {
      await whatsappService.disconnect();
    } catch (e: any) {
      logger.error({ error: e.message }, 'Error disconnecting WhatsApp service');
    }

    server.close(() => {
      logger.info('HTTP server closed. Exiting process.');
      process.exit(0);
    });

    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal error during bootstrap');
  process.exit(1);
});
