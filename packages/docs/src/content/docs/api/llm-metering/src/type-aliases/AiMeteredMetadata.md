---
editUrl: false
next: false
prev: false
title: "AiMeteredMetadata"
---

> **AiMeteredMetadata** = `object`

## Ai Metered

데코레이터가 사용하는 메타데이터 타입입니다.

## Properties

### embeddingUsageExtractor?

> `optional` **embeddingUsageExtractor?**: (`args`, `result`) => \{ `accuracy?`: `"EXACT"` \| `"ESTIMATED"` \| `"UNKNOWN"`; `tokens`: `number`; \} \| `null`

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

\{ `accuracy?`: `"EXACT"` \| `"ESTIMATED"` \| `"UNKNOWN"`; `tokens`: `number`; \} \| `null`

---

### idempotencyKeyExtractor?

> `optional` **idempotencyKeyExtractor?**: (`args`) => `string` \| `undefined`

#### Parameters

##### args

`unknown`[]

#### Returns

`string` \| `undefined`

---

### metadataExtractor?

> `optional` **metadataExtractor?**: (`args`, `result`) => `Record`\<`string`, `unknown`\> \| `undefined`

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

`Record`\<`string`, `unknown`\> \| `undefined`

---

### tenantId?

> `optional` **tenantId?**: `string`

---

### usageExtractor?

> `optional` **usageExtractor?**: (`args`, `result`) => \{ `accuracy?`: `"EXACT"` \| `"ESTIMATED"` \| `"UNKNOWN"`; `completionTokens`: `number`; `promptTokens`: `number`; \} \| `null`

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

\{ `accuracy?`: `"EXACT"` \| `"ESTIMATED"` \| `"UNKNOWN"`; `completionTokens`: `number`; `promptTokens`: `number`; \} \| `null`
