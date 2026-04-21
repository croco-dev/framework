---
editUrl: false
next: false
prev: false
title: "CircuitBreakerOptions"
---

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L6)

서킷 브레이커를 구성할 때 사용하는 옵션 타입입니다.

## Properties

### circuitId

> **circuitId**: `string`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:7](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L7)

***

### failureThreshold?

> `optional` **failureThreshold**: `number`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L8)

***

### fallback?

> `optional` **fallback**: [`CircuitBreakerFallback`](/api/retry-core/src/type-aliases/circuitbreakerfallback/)\<`unknown`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:12](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L12)

***

### halfOpenRequests?

> `optional` **halfOpenRequests**: `number`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:10](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L10)

***

### openDuration?

> `optional` **openDuration**: `number`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:9](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L9)

***

### stateStore?

> `optional` **stateStore**: [`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/)

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:11](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L11)
