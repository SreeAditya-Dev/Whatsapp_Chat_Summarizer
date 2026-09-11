import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

// Load environment variables from .env file (checks cwd, backend/, and project root)
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '.env'),
];
for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MISTRAL_API_KEY: z
    .string()
    .min(1, 'MISTRAL_API_KEY is required for chat summarization')
    .refine((v) => !v.startsWith('your_'), 'MISTRAL_API_KEY must not be the default placeholder'),
  MISTRAL_MODEL: z.string().default('open-mistral-nemo'),
  TELEGRAM_BOT_TOKEN: z
    .string()
    .min(1, 'TELEGRAM_BOT_TOKEN is required for Telegram bot interaction')
    .refine((v) => !v.startsWith('your_'), 'TELEGRAM_BOT_TOKEN must not be the default placeholder'),
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
  API_KEY: z.string().optional(),
  CHROME_PATH: z.string().optional(),
  HEADLESS: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),
  DEFAULT_SUMMARY_MESSAGE_LIMIT: z.coerce.number().int().min(5).max(500).default(100),
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
    console.error('👉 Please copy .env.example to .env and fill in valid values.\n');
  }
  // In test environment, provide test fallbacks
  if (process.env.NODE_ENV === 'test') {
    parsedEnv = {
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: 3000,
      MISTRAL_API_KEY: 'test_mistral_key',
      MISTRAL_MODEL: 'open-mistral-nemo',
      TELEGRAM_BOT_TOKEN: 'test_telegram_token',
      ALLOWED_TELEGRAM_USER_IDS: [123456789],
      API_KEY: undefined,
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
export const isProduction = env.NODE_ENV === 'production';
