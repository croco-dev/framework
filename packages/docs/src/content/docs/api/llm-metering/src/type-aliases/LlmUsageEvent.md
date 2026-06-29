---
editUrl: false
next: false
prev: false
title: "LlmUsageEvent"
---

> **LlmUsageEvent** = `object`

LlmMeteringService 입력과 결과에 사용하는 타입입니다.

## Properties

### idempotencyKey

> **idempotencyKey**: `string`

***

### metadata?

> `optional` **metadata?**: `Omit`\<[`LlmMetadata`](/api/llm-core/src/type-aliases/llmmetadata/), `"modelId"`\> & `object`

#### Type Declaration

##### operationType?

> `optional` **operationType?**: `string`

***

### modelId

> **modelId**: `string`

***

### provider

> **provider**: `string`

***

### tenantId

> **tenantId**: `string`

***

### usage

> **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)
