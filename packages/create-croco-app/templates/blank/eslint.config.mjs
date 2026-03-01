import { base } from '@croco/eslint-config';

export default [
  ...base,
  {
    ignores: ['node_modules', 'dist', '.turbo'],
  },
];
