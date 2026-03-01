import path from 'node:path';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../rules/no-datasource-import';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
});

ruleTester.run('no-datasource-import', rule, {
  valid: [
    {
      code: "import { Model } from './order.model';",
      filename: path.resolve('libs/order/src/datasource/order.repo.ts'),
    },
    {
      code: "import { Entity } from '../domain/order.entity';",
      filename: path.resolve('libs/order/src/service/order.service.ts'),
    },
    {
      code: "import { Repo } from '../../libs/order/src/datasource/order.repo';",
      filename: path.resolve('apps/api/src/resolver.ts'),
    },
    {
      code: "import { Base } from '../../../shared/src/datasource/base.repo';",
      filename: path.resolve('libs/order/src/datasource/order.repo.ts'),
    },
    {
      code: "import { Repository } from 'typeorm';",
      filename: path.resolve('libs/order/src/service/order.service.ts'),
    },
  ],
  invalid: [
    {
      code: "import { Repo } from '../datasource/order.repo';",
      filename: path.resolve('libs/order/src/domain/order.entity.ts'),
      errors: [{ messageId: 'noDatasourceImport' }],
    },
    {
      code: "import { Repo } from '../datasource/order.repo';",
      filename: path.resolve('libs/order/src/service/order.service.ts'),
      errors: [{ messageId: 'noDatasourceImport' }],
    },
    {
      code: "import { Repo } from '../datasource/order.repo';",
      filename: path.resolve('libs/order/src/application/order.facade.ts'),
      errors: [{ messageId: 'noDatasourceImport' }],
    },
    {
      code: "import { DB } from '../../../order/src/datasource/db';",
      filename: path.resolve('libs/order/src/service/order.service.ts'),
      errors: [{ messageId: 'noDatasourceImport' }],
    },
    {
      code: "import { Repo } from '../datasource/catalog.repo';",
      filename: path.resolve('libs/catalog/src/domain/catalog.entity.ts'),
      errors: [{ messageId: 'noDatasourceImport' }],
    },
  ],
});
