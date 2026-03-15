---
editUrl: false
next: false
prev: false
title: "RetryPolicy"
---

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:6](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/RetryPolicy.ts#L6)

Determines whether an error should trigger a retry.

## Methods

### shouldRetry()

> **shouldRetry**(`error`, `attempt`, `maxAttempts`): `boolean`

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:14](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/RetryPolicy.ts#L14)

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
