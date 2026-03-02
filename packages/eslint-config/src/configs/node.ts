import type { Linter } from 'eslint';
import globals from 'globals';
import base from './base';

const node: Linter.Config[] = [
  ...base,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];

export default node;
