---
editUrl: false
next: false
prev: false
title: "AiTelemetryBridge"
---

## Constructors

### Constructor

> **new AiTelemetryBridge**(): `AiTelemetryBridge`

#### Returns

`AiTelemetryBridge`

## Methods

### mapToGenAiAttributes()

> **mapToGenAiAttributes**(`usageRecord`): `Record`\<`string`, `unknown`\>

AiUsageRecord를 GenAI attributes로 매핑

#### Parameters

##### usageRecord

[`AiUsageRecord`](/api/ai-usage/src/type-aliases/aiusagerecord/)

#### Returns

`Record`\<`string`, `unknown`\>

#### Description

- 낮춤 attribute mapper 계층 (OTel semconv 변경 시 격리)
- GenAI Semantic Conventions 준수

---

### recordUsage()

> **recordUsage**(`usageRecord`, `span`): `Promise`\<`void`\>

AI 사용량 기록을 OTel GenAI Span으로 변환

#### Parameters

##### usageRecord

[`AiUsageRecord`](/api/ai-usage/src/type-aliases/aiusagerecord/)

##### span

[`AiTelemetrySpanAdapter`](/api/ai-usage/src/interfaces/aitelemetryspanadapter/)

#### Returns

`Promise`\<`void`\>

#### Description

- GenAI Semantic Conventions 준수
- Span에 attributes 설정
- recordEvent를 사용하여 ai-usage/usage 이벤트 기록
