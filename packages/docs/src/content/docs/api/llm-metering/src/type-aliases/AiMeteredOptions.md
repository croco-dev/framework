---
editUrl: false
next: false
prev: false
title: "AiMeteredOptions"
---

> **AiMeteredOptions** = `object`

## Ai Metered

데코레이터가 사용하는 메타데이터 타입입니다.

## Properties

### embeddingUsageExtractor()?

> `optional` **embeddingUsageExtractor**: (`args`, `result`) => \{ `accuracy?`: `"EXACT"` \| `"ESTIMATED"` \| `"UNKNOWN"`; `tokens`: `number`; \} \| `null`

메서드에서 embedding usage를 추출하는 함수

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

\{ `accuracy?`: `"EXACT"` \| `"ESTIMATED"` \| `"UNKNOWN"`; `tokens`: `number`; \} \| `null`

***

### idempotencyKeyExtractor()?

> `optional` **idempotencyKeyExtractor**: (`args`) => `string` \| `undefined`

idempotencyKey 추출기

#### Parameters

##### args

`unknown`[]

#### Returns

`string` \| `undefined`

***

### metadataExtractor()?

> `optional` **metadataExtractor**: (`args`, `result`) => `Record`\<`string`, `unknown`\> \| `undefined`

추가 메타데이터 추출기

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

`Record`\<`string`, `unknown`\> \| `undefined`

***

### tenantId?

> `optional` **tenantId**: `string`

LlmMeteringService에서 자동으로 추출하므로 생략 가능

***

### usageExtractor()?

> `optional` **usageExtractor**: (`args`, `result`) => \{ `accuracy?`: `"EXACT"` \| `"ESTIMATED"` \| `"UNKNOWN"`; `completionTokens`: `number`; `promptTokens`: `number`; \} \| `null`

메서드에서 usage를 추출하는 함수

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

\{ `accuracy?`: `"EXACT"` \| `"ESTIMATED"` \| `"UNKNOWN"`; `completionTokens`: `number`; `promptTokens`: `number`; \} \| `null`
