---
editUrl: false
next: false
prev: false
title: "CircuitState"
---

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:8](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/CircuitBreakerState.ts#L8)

Circuit Breaker 상태를 나타내는 열거형.

- CLOSED: 정상 상태, 모든 요청 허용
- OPEN: 차단 상태, 요청 거부 (fallback 또는 에러)
- HALF_OPEN: 테스트 상태, 제한된 요청 허용하여 시스템 복구 확인

## Enumeration Members

### CLOSED

> **CLOSED**: `"CLOSED"`

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:9](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/CircuitBreakerState.ts#L9)

***

### HALF\_OPEN

> **HALF\_OPEN**: `"HALF_OPEN"`

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:11](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/CircuitBreakerState.ts#L11)

***

### OPEN

> **OPEN**: `"OPEN"`

Defined in: [packages/retry-core/src/libs/CircuitBreakerState.ts:10](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/CircuitBreakerState.ts#L10)
