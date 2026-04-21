---
editUrl: false
next: false
prev: false
title: "CircuitStateTransition"
---

> **CircuitStateTransition** = \{ `from`: [`CLOSED`](/api/retry-core/src/enumerations/circuitstate/#closed); `reason`: `"failure_threshold_reached"`; `to`: [`OPEN`](/api/retry-core/src/enumerations/circuitstate/#open); \} \| \{ `from`: [`OPEN`](/api/retry-core/src/enumerations/circuitstate/#open); `reason`: `"timeout_elapsed"`; `to`: [`HALF_OPEN`](/api/retry-core/src/enumerations/circuitstate/#half_open); \} \| \{ `from`: [`HALF_OPEN`](/api/retry-core/src/enumerations/circuitstate/#half_open); `reason`: `"success_threshold_reached"`; `to`: [`CLOSED`](/api/retry-core/src/enumerations/circuitstate/#closed); \} \| \{ `from`: [`HALF_OPEN`](/api/retry-core/src/enumerations/circuitstate/#half_open); `reason`: `"failure_occurred"`; `to`: [`OPEN`](/api/retry-core/src/enumerations/circuitstate/#open); \}

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:22](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreakerState.ts#L22)

Circuit Breaker 상태 전환 규칙을 나타내는 타입.

- CLOSED → OPEN: 실패 임계치 도달
- OPEN → HALF_OPEN: openDuration 경과
- HALF_OPEN → CLOSED: successThreshold 충족
- HALF_OPEN → OPEN: 실패 발생
