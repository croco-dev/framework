---
editUrl: false
next: false
prev: false
title: "CircuitBreaker"
---

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:74](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreaker.ts#L74)

Circuit Breaker 구현.

실패 누적에 따라 요청을 차단하여 시스템 과부하를 방지합니다.

## Example

```typescript
const breaker = new CircuitBreaker({
  circuitId: 'api-service',
  failureThreshold: 5,
  openDuration: 60000,
});

try {
  const result = await breaker.execute(async () => {
    return await fetchApi();
  });
} catch (error) {
  if (error instanceof CircuitBreakerOpenException) {
    // 회로가 열려서 요청이 차단됨
  }
}
```

## Constructors

### Constructor

> **new CircuitBreaker**(`options`): `CircuitBreaker`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:82](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreaker.ts#L82)

#### Parameters

##### options

[`CircuitBreakerOptions`](/api/retry-core/src/interfaces/circuitbreakeroptions/)

#### Returns

`CircuitBreaker`

## Methods

### execute()

> **execute**\<`T`\>(`fn`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:98](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreaker.ts#L98)

작업을 Circuit Breaker로 보호하며 실행합니다.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `Promise`\<`T`\>

실행할 작업

#### Returns

`Promise`\<`T`\>

작업 결과

#### Throws

CircuitBreakerOpenException 회로가 OPEN 상태이고 fallback이 없는 경우

***

### forceClose()

> **forceClose**(): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:185](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreaker.ts#L185)

회로를 강제로 CLOSED 상태로 설정합니다.

서비스 복구 후 회로를 다시 열 때 사용합니다.

#### Returns

`Promise`\<`void`\>

***

### forceOpen()

> **forceOpen**(): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:175](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreaker.ts#L175)

회로를 강제로 OPEN 상태로 설정합니다.

유지보수 모드, 의도적인 서비스 차단 등에 사용합니다.

#### Returns

`Promise`\<`void`\>

***

### getFailureCount()

> **getFailureCount**(): `Promise`\<`number`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:215](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreaker.ts#L215)

현재 실패 카운트를 반환합니다.

#### Returns

`Promise`\<`number`\>

***

### getLastFailureTime()

> **getLastFailureTime**(): `Promise`\<`number` \| `null`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:222](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreaker.ts#L222)

마지막 실패 시간을 반환합니다.

#### Returns

`Promise`\<`number` \| `null`\>

***

### getState()

> **getState**(): `Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:208](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreaker.ts#L208)

현재 회로 상태를 반환합니다.

#### Returns

`Promise`\<[`CircuitState`](/api/retry-core/src/enumerations/circuitstate/)\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:196](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/CircuitBreaker.ts#L196)

회로의 모든 상태를 초기화합니다.

실패 카운트, 마지막 실패 시간, 상태가 모두 초기화됩니다.
참고: InMemoryCircuitBreakerStateStore 사용 시에만 지원됩니다.

#### Returns

`Promise`\<`void`\>
