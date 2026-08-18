---
editUrl: false
next: false
prev: false
title: "LlmQuotaPolicyContext"
---

> **LlmQuotaPolicyContext** = `object`

쿼터 정책을 실행할 때 전달하는 LLM 사용량 컨텍스트입니다.

## Properties

### idempotencyKey

> **idempotencyKey**: `string`

중복 기록을 방지하기 위한 멱등성 키입니다.

---

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

정책 구현체가 참고할 수 있는 추가 메타데이터입니다.

---

### meters

> **meters**: readonly [`LlmMeterUsageDelta`](/api/llm-metering/src/type-aliases/llmmeterusagedelta/)[]

이번 작업에서 기록하려는 메터 사용량 변화 목록입니다.

---

### modelId

> **modelId**: `string`

사용량이 발생한 모델 식별자입니다.

---

### operation

> **operation**: `string`

쿼터 검사 대상 작업 이름입니다.

---

### provider

> **provider**: `string`

사용량이 발생한 LLM 제공자 식별자입니다.

---

### tenantId

> **tenantId**: `string`

쿼터를 적용할 테넌트 식별자입니다.
