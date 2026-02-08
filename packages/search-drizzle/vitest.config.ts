import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    alias: {
      '@croco/search-core': resolve(__dirname, '../search-core/src/index.ts'),
      '@croco/framework-context': resolve(__dirname, '../framework-context/src/index.ts'),
    },
  },
});
