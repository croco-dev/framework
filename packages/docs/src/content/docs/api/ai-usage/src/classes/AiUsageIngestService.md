---
editUrl: false
next: false
prev: false
title: "AiUsageIngestService"
---

AI Metering 서비스

## Description

- metering-core를 래핑하여 AI 토큰/비용 추적 제공
- ingestGenerationUsage: generate/stream 호출 후 사용량 기록
- ingestEmbeddingUsage: embed/embedMany 호출 후 사용량 기록
- trackCost: AiPricingTable 기반 비용 계산
- checkQuota: quota 초과 체크

## Constructors

### Constructor

> **new AiUsageIngestService**(`options`): `AiUsageIngestService`

#### Parameters

##### options

[`AiUsageIngestServiceOptions`](/api/ai-usage/src/type-aliases/aiusageingestserviceoptions/)

#### Returns

`AiUsageIngestService`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`AiUsageIngestService`\>

## Methods

### checkQuota()

> **checkQuota**(`tenantId`, `meterId`, `quotaLimit`, `requestedUsage?`): `Promise`\<`boolean`\>

Quota 체크

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### quotaLimit

`number`

##### requestedUsage?

`number` = `0`

#### Returns

`Promise`\<`boolean`\>

#### Description

- tenantId별 quota 조회
- 초과 시 AiUsageQuotaExceededProblem throw

---

### ingestEmbeddingUsage()

> **ingestEmbeddingUsage**(`event`): `Promise`\<[`AiEmbeddingUsageRecord`](/api/ai-usage/src/type-aliases/aiembeddingusagerecord/)\>

임베딩 사용량 기록

#### Parameters

##### event

###### accuracy?

`"EXACT"` \| `"ESTIMATED"` \| `"UNKNOWN"`

###### embeddingTokens

`number`

###### idempotencyKey

`string`

###### modelId

`string`

###### provider

`string`

###### tenantId

`string`

#### Returns

`Promise`\<[`AiEmbeddingUsageRecord`](/api/ai-usage/src/type-aliases/aiembeddingusagerecord/)\>

#### Description

- 최대 2개 meter 기록: 0보다 큰 embedding_tokens, cost_usd_nanos
- embed/embedMany 전용

---

### ingestGenerationUsage()

> **ingestGenerationUsage**(`event`): `Promise`\<[`AiUsageRecord`](/api/ai-usage/src/type-aliases/aiusagerecord/)\>

텍스트 생성 사용량 기록

#### Parameters

##### event

[`AiUsageEvent`](/api/ai-usage/src/type-aliases/aiusageevent/)

#### Returns

`Promise`\<[`AiUsageRecord`](/api/ai-usage/src/type-aliases/aiusagerecord/)\>

#### Description

- 최대 3개 meter 기록: 0보다 큰 prompt_tokens, completion_tokens, cost_usd_nanos
- 멱등성 보장 (idempotencyKey:suffix)
- accuracy 플래그 전파 (EXACT | ESTIMATED | UNKNOWN)

---

### trackCost()

> **trackCost**(`event`): `Promise`\<[`AiCostRecord`](/api/ai-usage/src/type-aliases/aicostrecord/)\>

비용 추적 및 계산

#### Parameters

##### event

[`AiUsageEvent`](/api/ai-usage/src/type-aliases/aiusageevent/)

#### Returns

`Promise`\<[`AiCostRecord`](/api/ai-usage/src/type-aliases/aicostrecord/)\>

#### Description

- AiPricingTable 조회 → 비용 계산
- 비용이 0보다 클 때 cost_usd_nanos meter 기록
