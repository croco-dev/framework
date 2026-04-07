---
editUrl: false
next: false
prev: false
title: "CircuitBreakerOptions"
---

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:4](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L4)

Configuration type for creating a circuit breaker.

## Properties

### circuitId

> **circuitId**: `string`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:5](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L5)

***

### failureThreshold?

> `optional` **failureThreshold**: `number`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:6](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L6)

***

### fallback?

> `optional` **fallback**: [`CircuitBreakerFallback`](/api/retry-core/src/type-aliases/circuitbreakerfallback/)\<`unknown`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:10](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L10)

***

### halfOpenRequests?

> `optional` **halfOpenRequests**: `number`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:8](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L8)

***

### openDuration?

> `optional` **openDuration**: `number`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:7](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L7)

***

### stateStore?

> `optional` **stateStore**: [`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/)

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:9](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L9)
