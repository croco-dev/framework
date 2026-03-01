import type { Linter } from 'eslint';
import base from './base';

const react: Linter.Config[] = [
  ...base,
  // react-hooks config는 사용자가 직접 eslint-plugin-react-hooks를 설치해서 구성하도록 주석 안내
  {
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

export default react;
