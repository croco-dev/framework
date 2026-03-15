---
editUrl: false
next: false
prev: false
title: "ProblemDetails"
---

Defined in: [packages/problems-core/src/libs/Problem.ts:11](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/problems-core/src/libs/Problem.ts#L11)

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

## Indexable

\[`key`: `string`\]: `unknown`

## Properties

### code

> **code**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:17](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/problems-core/src/libs/Problem.ts#L17)

***

### detail?

> `optional` **detail**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:15](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/problems-core/src/libs/Problem.ts#L15)

***

### instance?

> `optional` **instance**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:16](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/problems-core/src/libs/Problem.ts#L16)

***

### status

> **status**: `number`

Defined in: [packages/problems-core/src/libs/Problem.ts:14](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/problems-core/src/libs/Problem.ts#L14)

***

### title

> **title**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:13](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/problems-core/src/libs/Problem.ts#L13)

***

### type

> **type**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:12](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/problems-core/src/libs/Problem.ts#L12)
