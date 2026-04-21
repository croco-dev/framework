---
editUrl: false
next: false
prev: false
title: "CircuitBreaker"
---

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:23](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L23)

실패율이 높은 의존성 호출을 차단하고 회복 여부를 관리하는 서킷 브레이커입니다.

## Constructors

### Constructor

> **new CircuitBreaker**(`options`): `CircuitBreaker`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:32](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L32)

#### Parameters

##### options

[`CircuitBreakerOptions`](/api/retry-core/src/interfaces/circuitbreakeroptions/)

#### Returns

`CircuitBreaker`

## Methods

### execute()

> **execute**\<`T`\>(`fn`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:51](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L51)

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

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:272](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L272)

#### Returns

`Promise`\<`void`\>

***

### forceOpen()

> **forceOpen**(): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:267](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L267)

#### Returns

`Promise`\<`void`\>

***

### getFailureCount()

> **getFailureCount**(): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:285](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L285)

#### Returns

`Promise`\<`number`\>

***

### getLastFailureTime()

> **getLastFailureTime**(): `Promise`\<`number` \| `null`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:289](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L289)

#### Returns

`Promise`\<`number` \| `null`\>

***

### getState()

> **getState**(): `Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:281](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L281)

#### Returns

`Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:277](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreaker.ts#L277)

#### Returns

`Promise`\<`void`\>
