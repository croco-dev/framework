---
editUrl: false
next: false
prev: false
title: "InMemoryCircuitBreakerStateStore"
---

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:84](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/CircuitBreakerState.ts#L84)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:97](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/CircuitBreakerState.ts#L97)

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

### getLastFailureTime()

> **getLastFailureTime**(`circuitId`): `Promise`\<`number` \| `null`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:112](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/CircuitBreakerState.ts#L112)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:89](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/CircuitBreakerState.ts#L89)

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

### incrementFailureCount()

> **incrementFailureCount**(`circuitId`): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:101](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/CircuitBreakerState.ts#L101)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:126](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/CircuitBreakerState.ts#L126)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:135](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/CircuitBreakerState.ts#L135)

모든 회로의 상태를 초기화합니다.

#### Returns

`Promise`\<`void`\>

***

### resetFailureCount()

> **resetFailureCount**(`circuitId`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:108](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/CircuitBreakerState.ts#L108)

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

### setLastFailureTime()

> **setLastFailureTime**(`circuitId`, `time`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:117](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/CircuitBreakerState.ts#L117)

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

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:93](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/CircuitBreakerState.ts#L93)

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
