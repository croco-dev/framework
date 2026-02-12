---
editUrl: false
next: false
prev: false
title: "TimeoutGuardOptions"
---

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:61](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L61)

Options for timeout guard.

## Properties

### getRemainingTime()?

> `optional` **getRemainingTime**: () => `number`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:66](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L66)

Custom timeout checker (for testing)

#### Returns

`number`

***

### reserveTimeMs?

> `optional` **reserveTimeMs**: `number`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:63](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L63)

Minimum time to reserve for cleanup (ms). Default: 5000
