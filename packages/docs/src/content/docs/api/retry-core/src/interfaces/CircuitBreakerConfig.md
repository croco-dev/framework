---
editUrl: false
next: false
prev: false
title: "CircuitBreakerConfig"
---

CircuitBreaker 설정 옵션.

## Properties

### failureThreshold

> **failureThreshold**: `number`

실패 임계값 - 이 횟수 이상 실패하면 OPEN 상태로 전환

---

### ~~halfOpenAttempts?~~

> `optional` **halfOpenAttempts**: `number`

:::caution[Deprecated]
successThreshold를 사용하세요
:::

---

### successThreshold?

> `optional` **successThreshold**: `number`

성공 임계값 (HALF_OPEN 상태에서 이 횟수 성공하면 CLOSED로 복귀)

---

### timeout?

> `optional` **timeout**: `number`

OPEN 상태 유지 시간 (밀리초)
