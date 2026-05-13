---
editUrl: false
next: false
prev: false
title: "CircuitState"
---

Circuit Breaker 상태를 나타내는 열거형.

- CLOSED: 정상 상태, 모든 요청 허용
- OPEN: 차단 상태, 요청 거부 (fallback 또는 에러)
- HALF_OPEN: 테스트 상태, 제한된 요청 허용하여 시스템 복구 확인

## Enumeration Members

### CLOSED

> **CLOSED**: `"CLOSED"`

***

### HALF\_OPEN

> **HALF\_OPEN**: `"HALF_OPEN"`

***

### OPEN

> **OPEN**: `"OPEN"`
