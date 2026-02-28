---
editUrl: false
next: false
prev: false
title: "ProblemOptions"
---

Defined in: [packages/problems-core/src/libs/Problem.ts:4](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/Problem.ts#L4)

RFC 7807 Problem Details의 직렬화 타입과 옵션 타입입니다.

## Example

```typescript
import type { ProblemDetails, ProblemOptions } from '@croco/problems-core';

const options: ProblemOptions = {
  type: 'https://docs.croco.dev/problems/user/not-found',
};

const details: ProblemDetails = {
  type: 'about:blank',
  title: 'Not Found',
  status: 404,
  code: 'user/not-found',
};
```

## Properties

### extensions?

> `optional` **extensions**: `Record`\<`string`, `unknown`\>

Defined in: [packages/problems-core/src/libs/Problem.ts:7](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/Problem.ts#L7)

***

### instance?

> `optional` **instance**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:6](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/Problem.ts#L6)

***

### type?

> `optional` **type**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:5](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/Problem.ts#L5)
