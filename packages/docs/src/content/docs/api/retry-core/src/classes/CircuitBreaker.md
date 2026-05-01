---
editUrl: false
next: false
prev: false
title: "CircuitBreaker"
---

실패율이 높은 의존성 호출을 차단하고 회복 여부를 관리하는 서킷 브레이커입니다.

## Constructors

### Constructor

> **new CircuitBreaker**(`options`): `CircuitBreaker`

#### Parameters

##### options

[`CircuitBreakerOptions`](/api/retry-core/src/interfaces/circuitbreakeroptions/)

#### Returns

`CircuitBreaker`

## Methods

### execute()

> **execute**\<`T`\>(`fn`): `Promise`\<`T`\>

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

#### Returns

`Promise`\<`void`\>

***

### forceOpen()

> **forceOpen**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### getFailureCount()

> **getFailureCount**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

***

### getLastFailureTime()

> **getLastFailureTime**(): `Promise`\<`number` \| `null`\>

#### Returns

`Promise`\<`number` \| `null`\>

***

### getState()

> **getState**(): `Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

#### Returns

`Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
