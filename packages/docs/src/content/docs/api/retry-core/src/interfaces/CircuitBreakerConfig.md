---
editUrl: false
next: false
prev: false
title: "CircuitBreakerConfig"
---

Defined in: [packages/retry-core/src/libs/Retryable.ts:17](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/Retryable.ts#L17)

CircuitBreaker 설정 옵션.

## Properties

### failureThreshold

> **failureThreshold**: `number`

Defined in: [packages/retry-core/src/libs/Retryable.ts:19](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/Retryable.ts#L19)

실패 임계값 - 이 횟수 이상 실패하면 OPEN 상태로 전환

***

### ~~halfOpenAttempts?~~

> `optional` **halfOpenAttempts**: `number`

Defined in: [packages/retry-core/src/libs/Retryable.ts:28](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/Retryable.ts#L28)

:::caution[Deprecated]
successThreshold를 사용하세요
:::

***

### successThreshold?

> `optional` **successThreshold**: `number`

Defined in: [packages/retry-core/src/libs/Retryable.ts:22](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/Retryable.ts#L22)

성공 임계값 (HALF_OPEN 상태에서 이 횟수 성공하면 CLOSED로 복귀)

***

### timeout?

> `optional` **timeout**: `number`

Defined in: [packages/retry-core/src/libs/Retryable.ts:25](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/Retryable.ts#L25)

OPEN 상태 유지 시간 (밀리초)
