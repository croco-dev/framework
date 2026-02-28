---
editUrl: false
next: false
prev: false
title: "InMemoryCircuitBreakerStateStore"
---

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:117](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L117)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:135](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L135)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:170](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L170)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:178](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L178)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:161](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L161)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:125](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L125)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:150](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L150)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:139](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L139)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:214](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L214)

특정 회로의 모든 상태를 초기화합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`reset`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#reset)

***

### resetAll()

> **resetAll**(): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:226](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L226)

모든 회로의 상태를 초기화합니다.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/).[`resetAll`](/api/retry-core/src/interfaces/circuitbreakerstatestore/#resetall)

***

### resetFailureCount()

> **resetFailureCount**(`circuitId`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:146](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L146)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:174](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L174)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:182](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L182)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:166](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L166)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:129](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L129)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:186](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/CircuitBreakerState.ts#L186)

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
