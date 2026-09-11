import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      MISTRAL_API_KEY: 'test_key',
      TELEGRAM_BOT_TOKEN: 'test_token',
      ALLOWED_TELEGRAM_USER_IDS: '123456789',
    },
  },
});
