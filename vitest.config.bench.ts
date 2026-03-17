import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    benchmark: {
      include: ['packages/**/src/tests/*.bench.ts'],
      reporters: ['default'],
    },
  },
});
