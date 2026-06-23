---
editUrl: false
next: false
prev: false
title: "CircuitBreakerOptions"
---

서킷 브레이커를 구성할 때 사용하는 옵션 타입입니다.

## Properties

### circuitId

> **circuitId**: `string`

---

### failureThreshold?

> `optional` **failureThreshold?**: `number`

---

### fallback?

> `optional` **fallback?**: [`CircuitBreakerFallback`](/api/retry-core/src/type-aliases/circuitbreakerfallback/)\<`unknown`\>

---

### halfOpenRequests?

> `optional` **halfOpenRequests?**: `number`

---

### openDuration?

> `optional` **openDuration?**: `number`

---

### stateStore?

> `optional` **stateStore?**: [`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/)
