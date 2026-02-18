---
editUrl: false
next: false
prev: false
title: "InMemoryCircuitBreakerStateStore"
---

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:99](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L99)

인메모리 Circuit Breaker 상태 저장소.

Lambda 환경에 최적화된 기본 구현입니다.
여러 Lambda 인스턴스 간에는 상태 공유되지 않습니다.
분산 환경에서는 Redis/DynamoDB 등의 구현체가 필요합니다.

## Implements

- [`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/)

## Constructors

### Constructor

> **new InMemoryCircuitBreakerStateStore**(): `InMemoryCircuitBreakerStateStore`

#### Returns

`InMemoryCircuitBreakerStateStore`

## Methods

### getFailureCount()

> **getFailureCount**(`circuitId`): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:117](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L117)

현재 실패 카운트를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

실패 횟수 (기본값: 0)

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`getFailureCount`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#getfailurecount)

***

### getHalfOpenActiveCount()

> **getHalfOpenActiveCount**(`circuitId`): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:152](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L152)

#### Parameters

##### circuitId

`string`

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`getHalfOpenActiveCount`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#gethalfopenactivecount)

***

### getHalfOpenSuccessCount()

> **getHalfOpenSuccessCount**(`circuitId`): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:160](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L160)

#### Parameters

##### circuitId

`string`

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`getHalfOpenSuccessCount`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#gethalfopensuccesscount)

***

### getLastFailureTime()

> **getLastFailureTime**(`circuitId`): `Promise`\<`number` \| `null`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:143](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L143)

마지막 실패 시간을 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number` \| `null`\>

타임스탬프 (ms) 또는 null (기본값: null)

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`getLastFailureTime`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#getlastfailuretime)

***

### getState()

> **getState**(`circuitId`): `Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:107](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L107)

현재 회로 상태를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

현재 상태 (기본값: CLOSED)

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`getState`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#getstate)

***

### incrementFailureAndCheck()

> **incrementFailureAndCheck**(`circuitId`, `failureThreshold`): `Promise`\<\{ `failureCount`: `number`; `shouldOpen`: `boolean`; \}\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:128](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L128)

#### Parameters

##### circuitId

`string`

##### failureThreshold

`number`

#### Returns

`Promise`\<\{ `failureCount`: `number`; `shouldOpen`: `boolean`; \}\>

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`incrementFailureAndCheck`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#incrementfailureandcheck)

***

### incrementFailureCount()

> **incrementFailureCount**(`circuitId`): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:121](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L121)

실패 카운트를 증가시키고 새 값을 반환합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

증가된 실패 카운트

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`incrementFailureCount`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#incrementfailurecount)

***

### reset()

> **reset**(`circuitId`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:196](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L196)

특정 회로의 모든 상태를 초기화합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`void`\>

***

### resetAll()

> **resetAll**(): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:208](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L208)

모든 회로의 상태를 초기화합니다.

#### Returns

`Promise`\<`void`\>

***

### resetFailureCount()

> **resetFailureCount**(`circuitId`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:139](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L139)

실패 카운트를 초기화합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`resetFailureCount`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#resetfailurecount)

***

### setHalfOpenActiveCount()

> **setHalfOpenActiveCount**(`circuitId`, `count`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:156](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L156)

#### Parameters

##### circuitId

`string`

##### count

`number`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`setHalfOpenActiveCount`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#sethalfopenactivecount)

***

### setHalfOpenSuccessCount()

> **setHalfOpenSuccessCount**(`circuitId`, `count`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:164](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L164)

#### Parameters

##### circuitId

`string`

##### count

`number`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`setHalfOpenSuccessCount`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#sethalfopensuccesscount)

***

### setLastFailureTime()

> **setLastFailureTime**(`circuitId`, `time`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:148](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L148)

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

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`setLastFailureTime`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#setlastfailuretime)

***

### setState()

> **setState**(`circuitId`, `state`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:111](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L111)

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

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`setState`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#setstate)

***

### withCircuitLock()

> **withCircuitLock**\<`T`\>(`circuitId`, `operation`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:168](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/CircuitBreakerState.ts#L168)

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

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`withCircuitLock`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#withcircuitlock)
