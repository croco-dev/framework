import js from '@eslint/js';
import type { Linter } from 'eslint';
import prettier from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';
import noCrossDomainImport from '../rules/no-cross-domain-import';
import noDatasourceImport from '../rules/no-datasource-import';
import typeGraphqlExplicitType from '../rules/type-graphql-explicit-type';

const dddPlugin = {
  name: 'croco-ddd',
  rules: {
    'no-cross-domain-import': noCrossDomainImport,
    'no-datasource-import': noDatasourceImport,
    'type-graphql-explicit-type': typeGraphqlExplicitType,
  },
};

const base: Linter.Config[] = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  prettier,
  {
    plugins: { 'croco-ddd': dddPlugin },
    rules: {
      'croco-ddd/no-cross-domain-import': 'error',
      'croco-ddd/no-datasource-import': 'error',
      'croco-ddd/type-graphql-explicit-type': 'warn',
    },
  },
];

export default base;
