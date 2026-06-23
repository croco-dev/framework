---
editUrl: false
next: false
prev: false
title: "createValidator"
---

> **createValidator**\<`T`\>(`schema`): `object`

동기, 비동기, 안전 파싱 API를 가진 검증 유틸리티를 생성합니다.

## Type Parameters

### T

`T`

## Parameters

### schema

`ZodType`\<`T`\>

## Returns

`object`

### parse

> **parse**: (`data`) => `T`

#### Parameters

##### data

`unknown`

#### Returns

`T`

### parseAsync

> **parseAsync**: (`data`) => `Promise`\<`T`\>

#### Parameters

##### data

`unknown`

#### Returns

`Promise`\<`T`\>

### safeParse

> **safeParse**: (`data`) => \{ `data`: `T`; `success`: `true`; \} \| \{ `error`: [`ValidationIssue`](/api/protocols-rest/src/type-aliases/validationissue/)[]; `success`: `false`; \}

#### Parameters

##### data

`unknown`

#### Returns

\{ `data`: `T`; `success`: `true`; \} \| \{ `error`: [`ValidationIssue`](/api/protocols-rest/src/type-aliases/validationissue/)[]; `success`: `false`; \}
