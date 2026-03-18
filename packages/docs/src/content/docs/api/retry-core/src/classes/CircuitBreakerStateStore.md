---
editUrl: false
next: false
prev: false
title: "CircuitBreakerStateStore"
---

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:28](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L28)

Circuit Breaker 상태 저장소 추상 클래스.

상태 저장소는 Circuit Breaker의 상태, 실패 카운트, 마지막 실패 시간을 저장합니다.
이 추상 클래스를 상속하여 InMemory 외에 Redis, DynamoDB 등 다양한 저장소를 지원할 수 있습니다.

## Extended by

- [`InMemoryCircuitBreakerStateStore`](/api/retry-core/src/classes/inmemorycircuitbreakerstatestore/)

## Constructors

### Constructor

> **new CircuitBreakerStateStore**(): `CircuitBreakerStateStore`

#### Returns

`CircuitBreakerStateStore`

## Methods

### getFailureCount()

> `abstract` **getFailureCount**(`circuitId`): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:51](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L51)

현재 실패 카운트를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

실패 횟수 (기본값: 0)

***

### getHalfOpenActiveCount()

> `abstract` **getHalfOpenActiveCount**(`circuitId`): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:91](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L91)

#### Parameters

##### circuitId

`string`

#### Returns

`Promise`\<`number`\>

***

### getHalfOpenSuccessCount()

> `abstract` **getHalfOpenSuccessCount**(`circuitId`): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:95](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L95)

#### Parameters

##### circuitId

`string`

#### Returns

`Promise`\<`number`\>

***

### getLastFailureTime()

> `abstract` **getLastFailureTime**(`circuitId`): `Promise`\<`number` \| `null`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:74](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L74)

마지막 실패 시간을 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number` \| `null`\>

타임스탬프 (ms) 또는 null (기본값: null)

***

### getState()

> `abstract` **getState**(`circuitId`): `Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:35](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L35)

현재 회로 상태를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

현재 상태 (기본값: CLOSED)

***

### incrementFailureAndCheck()

> `abstract` **incrementFailureAndCheck**(`circuitId`, `failureThreshold`): `Promise`\<\{ `failureCount`: `number`; `shouldOpen`: `boolean`; \}\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:86](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L86)

#### Parameters

##### circuitId

`string`

##### failureThreshold

`number`

#### Returns

`Promise`\<\{ `failureCount`: `number`; `shouldOpen`: `boolean`; \}\>

***

### incrementFailureCount()

> `abstract` **incrementFailureCount**(`circuitId`): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:59](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L59)

실패 카운트를 증가시키고 새 값을 반환합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

증가된 실패 카운트

***

### reset()

> `abstract` **reset**(`circuitId`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:99](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L99)

#### Parameters

##### circuitId

`string`

#### Returns

`Promise`\<`void`\>

***

### resetAll()

> `abstract` **resetAll**(): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:101](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L101)

#### Returns

`Promise`\<`void`\>

***

### resetFailureCount()

> `abstract` **resetFailureCount**(`circuitId`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:66](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L66)

실패 카운트를 초기화합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`void`\>

***

### setHalfOpenActiveCount()

> `abstract` **setHalfOpenActiveCount**(`circuitId`, `count`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:93](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L93)

#### Parameters

##### circuitId

`string`

##### count

`number`

#### Returns

`Promise`\<`void`\>

***

### setHalfOpenSuccessCount()

> `abstract` **setHalfOpenSuccessCount**(`circuitId`, `count`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:97](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L97)

#### Parameters

##### circuitId

`string`

##### count

`number`

#### Returns

`Promise`\<`void`\>

***

### setLastFailureTime()

> `abstract` **setLastFailureTime**(`circuitId`, `time`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:82](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L82)

마지막 실패 시간을 설정합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

##### time

`number`

타임스탬프 (ms)

#### Returns

`Promise`\<`void`\>

***

### setState()

> `abstract` **setState**(`circuitId`, `state`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:43](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L43)

회로 상태를 설정합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

##### state

[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)

설정할 상태

#### Returns

`Promise`\<`void`\>

***

### withCircuitLock()

> `abstract` **withCircuitLock**\<`T`\>(`circuitId`, `operation`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:84](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/CircuitBreakerState.ts#L84)

#### Type Parameters

##### T

`T`

#### Parameters

##### circuitId

`string`

##### operation

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>
