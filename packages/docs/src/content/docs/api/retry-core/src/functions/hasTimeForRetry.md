---
editUrl: false
next: false
prev: false
title: "hasTimeForRetry"
---

> **hasTimeForRetry**(`nextDelayMs`, `options?`): `boolean`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:76](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L76)

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
