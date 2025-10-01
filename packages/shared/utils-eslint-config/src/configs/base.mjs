import js from '@eslint/js';
import { globalIgnores } from 'eslint/config';
import importX from 'eslint-plugin-import-x';
import jsonc from 'eslint-plugin-jsonc';
import * as packageJson from 'eslint-plugin-package-json';
import prettier from 'eslint-plugin-prettier';
import jsoncParser from 'jsonc-eslint-parser';
import tseslint from 'typescript-eslint';

const base = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    name: 'base:common',
    linterOptions: { reportUnusedDisableDirectives: true },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      prettier,
      'import-x': importX,
    },
    rules: {
      'prettier/prettier': [
        'error',
        {
          trailingComma: 'es5',
          singleQuote: true,
          printWidth: 120,
          arrowParens: 'avoid',
          endOfLine: 'auto',
        },
      ],
      'import-x/extensions': 'off',
      'import-x/no-cycle': 'error',
      'import-x/no-extraneous-dependencies': 'off',
      'import-x/no-named-as-default': 'off',
      'import-x/no-relative-packages': 'off',
      'import-x/no-self-import': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['internal', 'external', 'builtin', 'parent', 'sibling'],
          pathGroups: [
            { pattern: '@*/**', group: 'internal', position: 'before' },
            { pattern: '@*/**', group: 'external', position: 'after' },
          ],
          pathGroupsExcludedImportTypes: [],
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/prefer-default-export': 'off',

      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'no-type-imports' }],
    },
    settings: {
      'import-x/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
    },
  },

  // JSON files
  {
    files: ['**/*.json'],
    languageOptions: { parser: jsoncParser },
    plugins: { jsonc },
    rules: {
      'jsonc/sort-keys': ['error'],
    },
  },

  // package.json
  {
    files: ['**/package.json'],
    languageOptions: { parser: jsoncParser },
    plugins: { 'package-json': packageJson },
    rules: {
      'jsonc/sort-keys': 'off',
      'package-json/sort-collections': 'error',
    },
  },
  globalIgnores(['dist/']),
];

export default base;
