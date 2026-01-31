import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
    globals: true,
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts', 'packages/**/src/**/*.spec.ts'],
    exclude: ['packages/utils-*/**', '**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['packages/utils-*/**', '**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts'],
    },
    testTimeout: 10000,
  },
});
