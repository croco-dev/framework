---
editUrl: false
next: false
prev: false
title: "CircuitBreakerStateStore"
---

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:20](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreakerState.ts#L20)

Circuit Breaker 상태 저장소 인터페이스.

상태 저장소는 Circuit Breaker의 상태, 실패 카운트, 마지막 실패 시간을 저장합니다.
이 인터페이스를 구현하여 InMemory 외에 Redis, DynamoDB 등 다양한 저장소를 지원할 수 있습니다.

## Methods

### getFailureCount()

> **getFailureCount**(`circuitId`): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:43](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreakerState.ts#L43)

현재 실패 카운트를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

실패 횟수 (기본값: 0)

***

### getLastFailureTime()

> **getLastFailureTime**(`circuitId`): `Promise`\<`number` \| `null`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:66](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreakerState.ts#L66)

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

> **getState**(`circuitId`): `Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:27](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreakerState.ts#L27)

현재 회로 상태를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

현재 상태 (기본값: CLOSED)

***

### incrementFailureCount()

> **incrementFailureCount**(`circuitId`): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:51](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreakerState.ts#L51)

실패 카운트를 증가시키고 새 값을 반환합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

증가된 실패 카운트

***

### resetFailureCount()

> **resetFailureCount**(`circuitId`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:58](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreakerState.ts#L58)

실패 카운트를 초기화합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`void`\>

***

### setLastFailureTime()

> **setLastFailureTime**(`circuitId`, `time`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:74](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreakerState.ts#L74)

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

> **setState**(`circuitId`, `state`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:35](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreakerState.ts#L35)

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
