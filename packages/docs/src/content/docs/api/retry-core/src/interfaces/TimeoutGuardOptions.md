---
editUrl: false
next: false
prev: false
title: "TimeoutGuardOptions"
---

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:61](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L61)

Options for timeout guard.

## Properties

### getRemainingTime()?

> `optional` **getRemainingTime**: () => `number`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:66](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L66)

Custom timeout checker (for testing)

#### Returns

`number`

***

### reserveTimeMs?

> `optional` **reserveTimeMs**: `number`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:63](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L63)

Minimum time to reserve for cleanup (ms). Default: 5000
