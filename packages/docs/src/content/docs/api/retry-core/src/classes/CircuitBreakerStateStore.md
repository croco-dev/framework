---
editUrl: false
next: false
prev: false
title: "CircuitBreakerStateStore"
---

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

현재 실패 카운트를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

실패 횟수 (기본값: 0)

---

### getHalfOpenActiveCount()

> `abstract` **getHalfOpenActiveCount**(`circuitId`): `Promise`\<`number`\>

HALF_OPEN 상태에서 현재 실행 중인 요청 수를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

활성 요청 수

---

### getHalfOpenSuccessCount()

> `abstract` **getHalfOpenSuccessCount**(`circuitId`): `Promise`\<`number`\>

HALF_OPEN 상태에서 성공한 요청 수를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

성공한 요청 수

---

### getLastFailureTime()

> `abstract` **getLastFailureTime**(`circuitId`): `Promise`\<`number`\>

마지막 실패 시간을 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

타임스탬프 (ms) 또는 null (기본값: null)

---

### getState()

> `abstract` **getState**(`circuitId`): `Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

현재 회로 상태를 가져옵니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

현재 상태 (기본값: CLOSED)

---

### incrementFailureAndCheck()

> `abstract` **incrementFailureAndCheck**(`circuitId`, `failureThreshold`): `Promise`\<\{ `failureCount`: `number`; `shouldOpen`: `boolean`; \}\>

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

---

### incrementFailureCount()

> `abstract` **incrementFailureCount**(`circuitId`): `Promise`\<`number`\>

실패 카운트를 증가시키고 새 값을 반환합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`number`\>

증가된 실패 카운트

---

### reset()

> `abstract` **reset**(`circuitId`): `Promise`\<`void`\>

특정 회로의 모든 상태를 초기화합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`void`\>

---

### resetAll()

> `abstract` **resetAll**(): `Promise`\<`void`\>

모든 회로의 상태를 초기화합니다.

#### Returns

`Promise`\<`void`\>

---

### resetFailureCount()

> `abstract` **resetFailureCount**(`circuitId`): `Promise`\<`void`\>

실패 카운트를 초기화합니다.

#### Parameters

##### circuitId

`string`

회로 식별자

#### Returns

`Promise`\<`void`\>

---

### setHalfOpenActiveCount()

> `abstract` **setHalfOpenActiveCount**(`circuitId`, `count`): `Promise`\<`void`\>

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

---

### setHalfOpenSuccessCount()

> `abstract` **setHalfOpenSuccessCount**(`circuitId`, `count`): `Promise`\<`void`\>

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

---

### setLastFailureTime()

> `abstract` **setLastFailureTime**(`circuitId`, `time`): `Promise`\<`void`\>

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

---

### setState()

> `abstract` **setState**(`circuitId`, `state`): `Promise`\<`void`\>

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

---

### withCircuitLock()

> `abstract` **withCircuitLock**\<`T`\>(`circuitId`, `operation`): `Promise`\<`T`\>

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
