import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    worker: 'src/index.ts',
  },
  format: ['esm'],
  platform: 'neutral',
  external: ['vike/server'],
  clean: true,
  minify: true,
  outExtension: () => ({ js: '.js' }),
});
