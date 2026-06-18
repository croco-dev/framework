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

> **operation**: `"generate"` \| `"embed"` \| `"cost_tracking"` \| `string`

사용량을 만든 작업 이름입니다. 내장 기록 경로는 generate, embed, cost_tracking을 명시
값으로 사용하며 스트리밍이나 통합 코드는 stream 같은 추가 작업 이름을 문자열 확장값으로
전달할 수 있습니다.

***

### value

> **value**: `number`

메트릭에 더할 값입니다.
