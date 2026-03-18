---
editUrl: false
next: false
prev: false
title: "CircuitBreakerOptions"
---

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:5](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L5)

Configuration type for creating a circuit breaker.

## Properties

### circuitId

> **circuitId**: `string`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:6](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L6)

***

### failureThreshold?

> `optional` **failureThreshold**: `number`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:7](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L7)

***

### fallback()?

> `optional` **fallback**: \<`T`\>() => `T` \| `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:11](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L11)

#### Type Parameters

##### T

`T`

#### Returns

`T` \| `Promise`\<`T`\>

***

### halfOpenRequests?

> `optional` **halfOpenRequests**: `number`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:9](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L9)

***

### openDuration?

> `optional` **openDuration**: `number`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:8](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L8)

***

### stateStore?

> `optional` **stateStore**: [`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/)

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:10](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L10)
