---
editUrl: false
next: false
prev: false
title: "InMemoryCircuitBreakerStateStore"
---

인메모리 Circuit Breaker 상태 저장소.

Lambda 환경에 최적화된 기본 구현입니다.
여러 Lambda 인스턴스 간에는 상태 공유되지 않습니다.
분산 환경에서는 Redis/DynamoDB 등의 구현체가 필요합니다.

## Extends

- [`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/)

## Constructors

### Constructor

> **new InMemoryCircuitBreakerStateStore**(`options?`): `InMemoryCircuitBreakerStateStore`

#### Parameters

##### options?

[`InMemoryCircuitBreakerStateStoreOptions`](/api/retry-core/src/type-aliases/inmemorycircuitbreakerstatestoreoptions/) = `{}`

#### Returns

`InMemoryCircuitBreakerStateStore`

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`constructor`](/api/retry-core/src/classes/circuitbreakerstatestore/#constructor)

## Methods

### getFailureCount()

> **getFailureCount**(`circuitId`): `Promise`\<`number`\>

현재 실패 카운트를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

실패 횟수 (기본값: 0)

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`getFailureCount`](/api/retry-core/src/classes/circuitbreakerstatestore/#getfailurecount)

***

### getHalfOpenActiveCount()

> **getHalfOpenActiveCount**(`circuitId`): `Promise`\<`number`\>

HALF_OPEN 상태에서 현재 실행 중인 요청 수를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

활성 요청 수

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`getHalfOpenActiveCount`](/api/retry-core/src/classes/circuitbreakerstatestore/#gethalfopenactivecount)

***

### getHalfOpenSuccessCount()

> **getHalfOpenSuccessCount**(`circuitId`): `Promise`\<`number`\>

HALF_OPEN 상태에서 성공한 요청 수를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

성공한 요청 수

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`getHalfOpenSuccessCount`](/api/retry-core/src/classes/circuitbreakerstatestore/#gethalfopensuccesscount)

***

### getLastFailureTime()

> **getLastFailureTime**(`circuitId`): `Promise`\<`number` \| `null`\>

마지막 실패 시간을 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number` \| `null`\>

타임스탬프 (ms) 또는 null (기본값: null)

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`getLastFailureTime`](/api/retry-core/src/classes/circuitbreakerstatestore/#getlastfailuretime)

***

### getState()

> **getState**(`circuitId`): `Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

현재 회로 상태를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

현재 상태 (기본값: CLOSED)

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`getState`](/api/retry-core/src/classes/circuitbreakerstatestore/#getstate)

***

### incrementFailureAndCheck()

> **incrementFailureAndCheck**(`circuitId`, `failureThreshold`): `Promise`\<\{ `failureCount`: `number`; `shouldOpen`: `boolean`; \}\>

실패 카운트를 증가시키고 열림 임계값을 초과했는지 확인합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

##### failureThreshold

`number`

실패 임계값

#### Returns

`Promise`\<\{ `failureCount`: `number`; `shouldOpen`: `boolean`; \}\>

증가된 실패 카운트와 열림 여부

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`incrementFailureAndCheck`](/api/retry-core/src/classes/circuitbreakerstatestore/#incrementfailureandcheck)

***

### incrementFailureCount()

> **incrementFailureCount**(`circuitId`): `Promise`\<`number`\>

실패 카운트를 증가시키고 새 값을 반환합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

증가된 실패 카운트

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`incrementFailureCount`](/api/retry-core/src/classes/circuitbreakerstatestore/#incrementfailurecount)

***

### reset()

> **reset**(`circuitId`): `Promise`\<`void`\>

특정 회로의 모든 상태를 초기화합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`void`\>

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`reset`](/api/retry-core/src/classes/circuitbreakerstatestore/#reset)

***

### resetAll()

> **resetAll**(): `Promise`\<`void`\>

모든 회로의 상태를 초기화합니다.

#### Returns

`Promise`\<`void`\>

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`resetAll`](/api/retry-core/src/classes/circuitbreakerstatestore/#resetall)

***

### resetFailureCount()

> **resetFailureCount**(`circuitId`): `Promise`\<`void`\>

실패 카운트를 초기화합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`void`\>

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`resetFailureCount`](/api/retry-core/src/classes/circuitbreakerstatestore/#resetfailurecount)

***

### setHalfOpenActiveCount()

> **setHalfOpenActiveCount**(`circuitId`, `count`): `Promise`\<`void`\>

HALF_OPEN 상태에서 활성 요청 수를 설정합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

##### count

`number`

설정할 카운트

#### Returns

`Promise`\<`void`\>

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`setHalfOpenActiveCount`](/api/retry-core/src/classes/circuitbreakerstatestore/#sethalfopenactivecount)

***

### setHalfOpenSuccessCount()

> **setHalfOpenSuccessCount**(`circuitId`, `count`): `Promise`\<`void`\>

HALF_OPEN 상태에서 성공한 요청 수를 설정합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

##### count

`number`

설정할 카운트

#### Returns

`Promise`\<`void`\>

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`setHalfOpenSuccessCount`](/api/retry-core/src/classes/circuitbreakerstatestore/#sethalfopensuccesscount)

***

### setLastFailureTime()

> **setLastFailureTime**(`circuitId`, `time`): `Promise`\<`void`\>

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

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`setLastFailureTime`](/api/retry-core/src/classes/circuitbreakerstatestore/#setlastfailuretime)

***

### setState()

> **setState**(`circuitId`, `state`): `Promise`\<`void`\>

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

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`setState`](/api/retry-core/src/classes/circuitbreakerstatestore/#setstate)

***

### withCircuitLock()

> **withCircuitLock**\<`T`\>(`circuitId`, `operation`): `Promise`\<`T`\>

분산 락을 사용하여 회로별 작업을 원자적으로 실행합니다.

#### Type Parameters

##### T

`T`

#### Parameters

##### circuitId

`string`

회로 식별자

##### operation

() => `Promise`\<`T`\>

원자적으로 실행할 작업

#### Returns

`Promise`\<`T`\>

작업 결과

#### Overrides

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/).[`withCircuitLock`](/api/retry-core/src/classes/circuitbreakerstatestore/#withcircuitlock)
