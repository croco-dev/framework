---
editUrl: false
next: false
prev: false
title: "DeadLetterPolicy"
---

> **DeadLetterPolicy** = `object`

DLQ 정책 설정입니다.

## Properties

### backoffMultiplier

> **backoffMultiplier**: `number`

지수 백오프 배율 (1이면 고정 간격, 2면 2배씩 증가)

---

### maxRetries

> **maxRetries**: `number`

최대 재시도 횟수 (이 횟수를 초과하면 DLQ로 이동)

---

### maxRetryDelayMs

> **maxRetryDelayMs**: `number`

최대 재시도 간격 (ms, 백오프 상한)

---

### retentionDays

> **retentionDays**: `number`

DLQ 보관 기간 (일)

---

### retryDelayMs

> **retryDelayMs**: `number`

재시도 간격 (ms)
