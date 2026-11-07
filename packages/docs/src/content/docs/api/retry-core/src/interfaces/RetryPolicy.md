---
editUrl: false
next: false
prev: false
title: "RetryPolicy"
---

Determines whether an error should trigger a retry.

## Methods

### isRetryable()?

> `optional` **isRetryable**(`error`): `boolean`

Classify the final error independently of the attempt budget, without scheduling another attempt.
Called only when `shouldRetry` rejects the final failure. A true result enables exhaustion
hooks and recovery; false (or an absent classifier) propagates the original error directly.

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

---

### shouldRetry()

> **shouldRetry**(`error`, `attempt`, `maxAttempts`): `boolean`

Check if the given error should be retried.
Called once per failed operation with its actual attempt and configured limit.
A false result is terminal unless the final failure is classified by `isRetryable`.

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
