---
editUrl: false
next: false
prev: false
title: "hasTimeForRetry"
---

> **hasTimeForRetry**(`nextDelayMs`, `options?`): `boolean`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:76](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L76)

Check if there's enough time for another retry attempt.

## Parameters

### nextDelayMs

`number`

Expected delay before next attempt

### options?

[`TimeoutGuardOptions`](/api/retry-core/src/interfaces/timeoutguardoptions/) = `{}`

Guard options

## Returns

`boolean`

true if there's enough time, false otherwise
