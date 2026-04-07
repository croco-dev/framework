---
editUrl: false
next: false
prev: false
title: "DeadLetterPolicy"
---

> **DeadLetterPolicy** = `object`

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:32](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L32)

DLQ 정책 설정입니다.

## Properties

### backoffMultiplier

> **backoffMultiplier**: `number`

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:40](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L40)

지수 백오프 배율 (1이면 고정 간격, 2면 2배씩 증가)

***

### maxRetries

> **maxRetries**: `number`

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:34](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L34)

최대 재시도 횟수 (이 횟수를 초과하면 DLQ로 이동)

***

### maxRetryDelayMs

> **maxRetryDelayMs**: `number`

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:43](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L43)

최대 재시도 간격 (ms, 백오프 상한)

***

### retentionDays

> **retentionDays**: `number`

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:46](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L46)

DLQ 보관 기간 (일)

***

### retryDelayMs

> **retryDelayMs**: `number`

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:37](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L37)

재시도 간격 (ms)
