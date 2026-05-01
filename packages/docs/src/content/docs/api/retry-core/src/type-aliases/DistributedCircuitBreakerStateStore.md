---
editUrl: false
next: false
prev: false
title: "DistributedCircuitBreakerStateStore"
---

> **DistributedCircuitBreakerStateStore** = [`CircuitBreakerStateStore`](/api/retry-core/src/classes/circuitbreakerstatestore/)

분산 환경(Redis, DynamoDB 등)에서 사용 가능한 Circuit Breaker 상태 저장소 인터페이스.

:::caution[Deprecated]
CircuitBreakerStateStore를 직접 사용하세요. 모든 CircuitBreakerStateStore 구현체는
기본적으로 분산 환경을 지원합니다.
:::
