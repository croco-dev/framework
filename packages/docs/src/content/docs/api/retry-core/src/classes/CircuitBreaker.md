---
editUrl: false
next: false
prev: false
title: "CircuitBreaker"
---

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:14](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L14)

Circuit breaker implementation for preventing repeated calls to unstable dependencies.

## Constructors

### Constructor

> **new CircuitBreaker**(`options`): `CircuitBreaker`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:23](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L23)

#### Parameters

##### options

[`CircuitBreakerOptions`](/api/retry-core/src/interfaces/circuitbreakeroptions/)

#### Returns

`CircuitBreaker`

## Methods

### execute()

> **execute**\<`T`\>(`fn`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:32](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L32)

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

***

### forceClose()

> **forceClose**(): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:253](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L253)

#### Returns

`Promise`\<`void`\>

***

### forceOpen()

> **forceOpen**(): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:248](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L248)

#### Returns

`Promise`\<`void`\>

***

### getFailureCount()

> **getFailureCount**(): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:266](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L266)

#### Returns

`Promise`\<`number`\>

***

### getLastFailureTime()

> **getLastFailureTime**(): `Promise`\<`number` \| `null`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:270](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L270)

#### Returns

`Promise`\<`number` \| `null`\>

***

### getState()

> **getState**(): `Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:262](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L262)

#### Returns

`Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:258](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreaker.ts#L258)

#### Returns

`Promise`\<`void`\>
