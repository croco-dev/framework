import path from 'node:path';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../rules/no-cross-domain-import';

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

ruleTester.run('no-cross-domain-import', rule, {
  valid: [
    {
      code: "import { Item } from '../domain/order-item';",
      filename: path.resolve('libs/order/src/domain/order.ts'),
    },
    {
      code: "import { util } from '../../../shared/src/utils';",
      filename: path.resolve('libs/order/src/service/order.service.ts'),
    },
    {
      code: "import { Repo } from '../../../user/src/datasource/user.repo';",
      filename: path.resolve('libs/order/src/datasource/order.repo.ts'),
    },
    {
      code: "import { Order } from '../../libs/order/src/domain/order';",
      filename: path.resolve('apps/api/src/resolver.ts'),
    },
    {
      code: "import ext from 'some-external-package';",
      filename: path.resolve('libs/order/src/domain/order.ts'),
    },
    {
      code: "import { Model } from './order.model';",
      filename: path.resolve('libs/order/src/datasource/order.repo.ts'),
    },
  ],
  invalid: [
    {
      code: "import { User } from '../../../user/src/domain/user';",
      filename: path.resolve('libs/order/src/domain/order.ts'),
      errors: [{ messageId: 'crossDomainImport' }],
    },
    {
      code: "import { UserService } from '../../../user/src/service/user.service';",
      filename: path.resolve('libs/order/src/service/order.service.ts'),
      errors: [{ messageId: 'crossDomainImport' }],
    },
    {
      code: "import { Payment } from '../../../payment/src/domain/payment';",
      filename: path.resolve('libs/catalog/src/service/catalog.service.ts'),
      errors: [{ messageId: 'crossDomainImport' }],
    },
    {
      code: "import { Facade } from '../../../payment/src/application/payment.facade';",
      filename: path.resolve('libs/order/src/domain/order.ts'),
      errors: [{ messageId: 'crossDomainImport' }],
    },
    {
      code: "import { Repo } from '../../../order/src/datasource/order.repo';",
      filename: path.resolve('libs/catalog/src/service/catalog.service.ts'),
      errors: [{ messageId: 'crossDomainImport' }],
    },
  ],
});
