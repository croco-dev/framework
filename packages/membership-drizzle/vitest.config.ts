import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    alias: {
      '@croco/framework-context': resolve(__dirname, '../framework-context/src/index.ts'),
      '@croco/membership-core': resolve(__dirname, '../membership-core/src/index.ts'),
      '@croco/tx-core': resolve(__dirname, '../tx-core/src/index.ts'),
      '@croco/tx-drizzle': resolve(__dirname, '../tx-drizzle/src/index.ts'),
    },
  },
});
