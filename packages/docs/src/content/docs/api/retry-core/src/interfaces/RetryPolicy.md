---
editUrl: false
next: false
prev: false
title: "RetryPolicy"
---

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:6](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/retry-core/src/libs/RetryPolicy.ts#L6)

Determines whether an error should trigger a retry.

## Methods

### shouldRetry()

> **shouldRetry**(`error`, `attempt`, `maxAttempts`): `boolean`

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:14](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/retry-core/src/libs/RetryPolicy.ts#L14)

Check if the given error should be retried.

#### Parameters

##### error

`unknown`

The error that occurred

##### attempt

`number`

Current attempt number (1-based)

##### maxAttempts

`number`

Maximum allowed attempts

#### Returns

`boolean`

true if should retry, false otherwise
