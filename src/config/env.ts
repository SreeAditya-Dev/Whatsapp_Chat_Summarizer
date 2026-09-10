import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10)),
  MISTRAL_API_KEY: z.string().min(1, 'MISTRAL_API_KEY is required for chat summarization'),
  MISTRAL_MODEL: z.string().default('mistral-small-latest'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required for Telegram bot interaction'),
  ALLOWED_TELEGRAM_USER_IDS: z
    .string()
    .default('')
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => Number(s))
        .filter((n) => !isNaN(n))
    ),
  CHROME_PATH: z.string().optional(),
  HEADLESS: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),
  DEFAULT_SUMMARY_MESSAGE_LIMIT: z
    .string()
    .default('100')
    .transform((val) => parseInt(val, 10)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let parsedEnv: EnvConfig;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const missingVars = error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    console.error('\n❌ Invalid or missing environment configuration:\n' + missingVars + '\n');
    console.error('👉 Please copy .env.example to .env and fill in the required values.\n');
  }
  // In test environment, provide fallback or rethrow
  if (process.env.NODE_ENV === 'test') {
    parsedEnv = {
      NODE_ENV: 'test',
      PORT: 3000,
      MISTRAL_API_KEY: 'test_mistral_key',
      MISTRAL_MODEL: 'mistral-small-latest',
      TELEGRAM_BOT_TOKEN: 'test_telegram_token',
      ALLOWED_TELEGRAM_USER_IDS: [123456789],
      CHROME_PATH: undefined,
      HEADLESS: true,
      DEFAULT_SUMMARY_MESSAGE_LIMIT: 100,
      LOG_LEVEL: 'info',
    };
  } else {
    process.exit(1);
  }
}

export const env = parsedEnv;
