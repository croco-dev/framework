import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@croco/framework-context': '../framework-context/src/index.ts',
      '@croco/protocols-rest': '../protocols-rest/src/index.ts',
    },
  },
});
