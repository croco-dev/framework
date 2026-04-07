---
editUrl: false
next: false
prev: false
title: "isDistributedStore"
---

> **isDistributedStore**(`_store`): `_store is CircuitBreakerStateStore`

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:178](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/CircuitBreakerState.ts#L178)

주어진 저장소가 분산 환경을 지원하는지 확인합니다.

:::caution[Deprecated]
모든 CircuitBreakerStateStore는 기본적으로 분산 환경을 지원합니다.
이 함수는 항상 true를 반환하며, 향후 버전에서 제거될 예정입니다.
:::

## Parameters

### \_store

[`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/)

## Returns

`_store is CircuitBreakerStateStore`
