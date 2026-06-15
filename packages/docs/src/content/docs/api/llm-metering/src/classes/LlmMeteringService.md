---
editUrl: false
next: false
prev: false
title: "LlmMeteringService"
---

LLM Metering 서비스

## Description

- metering-core를 래핑하여 LLM 토큰/비용 추적 제공
- recordUsage: generate/stream 호출 후 사용량 기록
- recordEmbeddingUsage: embed/embedMany 호출 후 사용량 기록
- trackCost: PricingTable 기반 비용 계산
- checkQuota: quota 초과 체크

## Constructors

### Constructor

> **new LlmMeteringService**(`options`): `LlmMeteringService`

#### Parameters

##### options

[`LlmMeteringServiceOptions`](/api/llm-metering/src/type-aliases/llmmeteringserviceoptions/)

#### Returns

`LlmMeteringService`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`LlmMeteringService`\>

## Methods

### checkQuota()

> **checkQuota**(`tenantId`, `meterId`, `quotaLimit`): `Promise`\<`boolean`\>

Quota 체크

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### quotaLimit

`number`

#### Returns

`Promise`\<`boolean`\>

#### Description

- tenantId별 quota 조회
- 초과 시 LlmQuotaExceededProblem throw

***

### recordEmbeddingUsage()

> **recordEmbeddingUsage**(`event`): `Promise`\<[`LlmEmbeddingUsageRecord`](/api/llm-metering/src/type-aliases/llmembeddingusagerecord/)\>

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

`Promise`\<[`LlmEmbeddingUsageRecord`](/api/llm-metering/src/type-aliases/llmembeddingusagerecord/)\>

#### Description

- 2개 meter 기록: embedding_tokens, cost_usd
- embed/embedMany 전용

***

### recordUsage()

> **recordUsage**(`event`): `Promise`\<[`LlmUsageRecord`](/api/llm-metering/src/type-aliases/llmusagerecord/)\>

텍스트 생성 사용량 기록

#### Parameters

##### event

[`LlmUsageEvent`](/api/llm-metering/src/type-aliases/llmusageevent/)

#### Returns

`Promise`\<[`LlmUsageRecord`](/api/llm-metering/src/type-aliases/llmusagerecord/)\>

#### Description

- 3개 meter 동시 기록: prompt_tokens, completion_tokens, cost_usd
- 멱등성 보장 (idempotencyKey:suffix)
- accuracy 플래그 전파 (reported|estimated)

***

### trackCost()

> **trackCost**(`event`): `Promise`\<[`LlmCostRecord`](/api/llm-metering/src/type-aliases/llmcostrecord/)\>

비용 추적 및 계산

#### Parameters

##### event

[`LlmUsageEvent`](/api/llm-metering/src/type-aliases/llmusageevent/)

#### Returns

`Promise`\<[`LlmCostRecord`](/api/llm-metering/src/type-aliases/llmcostrecord/)\>

#### Description

- PricingTable 조회 → 비용 계산
- cost_usd meter 기록
