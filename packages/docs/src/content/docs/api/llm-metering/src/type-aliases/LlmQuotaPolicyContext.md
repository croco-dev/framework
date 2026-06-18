---
editUrl: false
next: false
prev: false
title: "LlmQuotaPolicyContext"
---

> **LlmQuotaPolicyContext** = `object`

비용 예산, 모델 단가, 사용량 기록 타입입니다.

## Properties

### idempotencyKey

> **idempotencyKey**: `string`

***

### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

***

### meters

> **meters**: readonly [`LlmMeterUsageDelta`](/api/llm-metering/src/type-aliases/llmmeterusagedelta/)[]

***

### modelId

> **modelId**: `string`

***

### operation

> **operation**: `string`

***

### provider

> **provider**: `string`

***

### tenantId

> **tenantId**: `string`
