---
editUrl: false
next: false
prev: false
title: "CircuitBreakerOptions"
---

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:8](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/CircuitBreaker.ts#L8)

Circuit Breaker 옵션.

## Properties

### circuitId

> **circuitId**: `string`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:13](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/CircuitBreaker.ts#L13)

Circuit 식별자.
여러 Circuit Breaker 인스턴스를 구분하는 데 사용됩니다.

***

### failureThreshold?

> `optional` **failureThreshold**: `number`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:20](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/CircuitBreaker.ts#L20)

OPEN으로 전환되는 실패 임계값.
이 횟수만큼 실패가 누적되면 회로가 열립니다.

#### Default

```ts
5
```

***

### fallback()?

> `optional` **fallback**: \<`T`\>() => `T` \| `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:47](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/CircuitBreaker.ts#L47)

OPEN 시 호출할 fallback 함수.
설정되지 않으면 CircuitBreakerOpenException이 발생합니다.

#### Type Parameters

##### T

`T`

#### Returns

`T` \| `Promise`\<`T`\>

***

### halfOpenRequests?

> `optional` **halfOpenRequests**: `number`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:34](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/CircuitBreaker.ts#L34)

HALF_OPEN에서 허용할 테스트 요청 수.
이 횟수만큼 요청이 성공하면 CLOSED 상태로 복귀합니다.

#### Default

```ts
1
```

***

### openDuration?

> `optional` **openDuration**: `number`

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:27](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/CircuitBreaker.ts#L27)

OPEN 상태 유지 시간 (밀리초).
이 시간이 지난 후 HALF_OPEN 상태로 전환하여 시스템 복구를 확인합니다.

#### Default

```ts
30000 (30초)
```

***

### stateStore?

> `optional` **stateStore**: [`CircuitBreakerStateStore`](/api/retry-core/src/interfaces/circuitbreakerstatestore/)

Defined in: [packages/retry-core/src/libs/CircuitBreaker.ts:41](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/CircuitBreaker.ts#L41)

상태 저장소.
기본적으로 InMemoryCircuitBreakerStateStore가 사용됩니다.
Redis, DynamoDB 등의 다른 구현체로 교체 가능합니다.
