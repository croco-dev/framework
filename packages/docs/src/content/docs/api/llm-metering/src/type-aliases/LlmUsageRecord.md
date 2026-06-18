---
editUrl: false
next: false
prev: false
title: "LlmUsageRecord"
---

> **LlmUsageRecord** = `object`

텍스트 생성 호출에서 기록된 토큰 사용량과 비용입니다.

## Properties

### accuracy?

> `optional` **accuracy**: [`UsageAccuracy`](/api/llm-metering/src/type-aliases/usageaccuracy/)

***

### completionTokens

> **completionTokens**: `number`

***

### costUsd

> **costUsd**: `number`

***

### idempotencyKey

> **idempotencyKey**: `string`

***

### modelId

> **modelId**: `string`

***

### promptTokens

> **promptTokens**: `number`

***

### provider

> **provider**: `string`

***

### tenantId

> **tenantId**: `string`

***

### timestamp

> **timestamp**: `Date`
