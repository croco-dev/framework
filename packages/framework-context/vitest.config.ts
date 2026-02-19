import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      SKIP_ENV_VALIDATION: '1',
    },
  },
});
