import type { Linter } from 'eslint';
import react from './react';

const next: Linter.Config[] = [
  ...react,
  // @next/eslint-plugin-next는 peerDeps로 처리
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-img-element': 'warn',
    },
  },
];

export default next;
