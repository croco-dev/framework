---
editUrl: false
next: false
prev: false
title: "TimeoutGuardOptions"
---

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:73](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L73)

Options for timeout guard.

## Properties

### getRemainingTime()?

> `optional` **getRemainingTime**: () => `number`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:78](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L78)

Custom timeout checker (for testing)

#### Returns

`number`

***

### reserveTimeMs?

> `optional` **reserveTimeMs**: `number`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:75](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L75)

Minimum time to reserve for cleanup (ms). Default: 5000
