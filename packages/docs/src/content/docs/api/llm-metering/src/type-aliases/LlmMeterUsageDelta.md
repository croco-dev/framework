---
editUrl: false
next: false
prev: false
title: "LlmMeterUsageDelta"
---

> **LlmMeterUsageDelta** = `object`

메터링 기록에 더할 사용량 변화(delta)를 나타내는 타입입니다.

## Properties

### meterId

> **meterId**: [`LlmMeterId`](/api/llm-metering/src/type-aliases/llmmeterid/)

변화량이 적용될 메트릭 식별자입니다.

***

### operation

> **operation**: `"generate"` \| `"stream"` \| `"embed"` \| `"cost_tracking"` \| `string`

사용량을 만든 작업 이름입니다. 내장 경로는 generate, stream, embed, cost_tracking을 사용하며
통합 코드가 추가 작업 이름을 전달할 수 있습니다.

***

### value

> **value**: `number`

메트릭에 더할 값입니다.
