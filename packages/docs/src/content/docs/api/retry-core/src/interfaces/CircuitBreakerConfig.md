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

실패 임계값 - 양의 안전 정수이며, 이 횟수 이상 실패하면 OPEN 상태로 전환

***

### stateStore?

> `optional` **stateStore?**: [`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/)

상태 공유 범위를 제어하는 저장소 (기본값: decorated method별 in-memory store)

***

### successThreshold?

> `optional` **successThreshold?**: `number`

양의 안전 정수 성공 임계값 (HALF_OPEN 상태에서 이 횟수 성공하면 CLOSED로 복귀)

***

### timeout?

> `optional` **timeout?**: `number`

OPEN 상태 유지 시간 (1 이상 2,147,483,647 이하의 정수 밀리초)
