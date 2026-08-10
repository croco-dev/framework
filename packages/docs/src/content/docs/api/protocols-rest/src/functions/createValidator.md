---
editUrl: false
next: false
prev: false
title: "createValidator"
---

> **createValidator**\<`TSchema`\>(`schema`): `object`

동기, 비동기, 안전 파싱 API를 가진 검증 유틸리티를 생성합니다.

## Type Parameters

### TSchema

`TSchema` _extends_ `ZodType`\<`any`, `ZodTypeDef`, `any`\>

## Parameters

### schema

`TSchema`

## Returns

`object`

### parse

> **parse**: (`data`) => `output`\<`TSchema`\>

#### Parameters

##### data

`unknown`

#### Returns

`output`\<`TSchema`\>

### parseAsync

> **parseAsync**: (`data`) => `Promise`\<`output`\<`TSchema`\>\>

#### Parameters

##### data

`unknown`

#### Returns

`Promise`\<`output`\<`TSchema`\>\>

### safeParse

> **safeParse**: (`data`) => \{ `data`: `output`\<`TSchema`\>; `success`: `true`; \} \| \{ `error`: [`ValidationIssue`](/api/protocols-rest/src/type-aliases/validationissue/)[]; `success`: `false`; \}

#### Parameters

##### data

`unknown`

#### Returns

\{ `data`: `output`\<`TSchema`\>; `success`: `true`; \} \| \{ `error`: [`ValidationIssue`](/api/protocols-rest/src/type-aliases/validationissue/)[]; `success`: `false`; \}
