import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

export default defineConfig({
  input: 'src/index.ts',
  external: ['next/font/local'],
  output: [
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/index.mjs',
      format: 'esm',
      sourcemap: true,
    },
  ],
  plugins: [
    typescript({
      compilerOptions: {
        outDir: 'dist',
      },
    }),
  ],
});
