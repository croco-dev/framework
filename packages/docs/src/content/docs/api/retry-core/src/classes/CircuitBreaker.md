---
editUrl: false
next: false
prev: false
title: "CircuitBreaker"
---

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:18](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L18)

Circuit breaker implementation for preventing repeated calls to unstable dependencies.

## Constructors

### Constructor

> **new CircuitBreaker**(`options`): `CircuitBreaker`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:27](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L27)

#### Parameters

##### options

[`CircuitBreakerOptions`](/api/retry-core/src/interfaces/circuitbreakeroptions/)

#### Returns

`CircuitBreaker`

## Methods

### execute()

> **execute**\<`T`\>(`fn`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:36](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L36)

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

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:257](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L257)

#### Returns

`Promise`\<`void`\>

***

### forceOpen()

> **forceOpen**(): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:252](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L252)

#### Returns

`Promise`\<`void`\>

***

### getFailureCount()

> **getFailureCount**(): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:270](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L270)

#### Returns

`Promise`\<`number`\>

***

### getLastFailureTime()

> **getLastFailureTime**(): `Promise`\<`number` \| `null`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:274](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L274)

#### Returns

`Promise`\<`number` \| `null`\>

***

### getState()

> **getState**(): `Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:266](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L266)

#### Returns

`Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:262](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreaker.ts#L262)

#### Returns

`Promise`\<`void`\>
