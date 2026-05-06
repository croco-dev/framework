import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/metadata-reader.ts', 'src/compiler.ts', 'src/__tests__/fixtures/SampleController.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  minify: false,
  external: ['reflect-metadata'],
  noExternal: ['@croco/framework-context', '@croco/protocols-rest'],
});
