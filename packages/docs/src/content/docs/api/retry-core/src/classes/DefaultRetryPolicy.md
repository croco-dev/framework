---
editUrl: false
next: false
prev: false
title: "DefaultRetryPolicy"
---

Default retry policy that honors an error's explicit `retryable` classification before ProblemCategory.

## Implements

- [`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/)

## Constructors

### Constructor

> **new DefaultRetryPolicy**(`options?`): `DefaultRetryPolicy`

#### Parameters

##### options?

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/) = `{}`

#### Returns

`DefaultRetryPolicy`

## Methods

### isRetryable()

> **isRetryable**(`error`): `boolean`

Classify an error without applying the attempt limit.

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

#### Implementation of

[`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/).[`isRetryable`](/api/retry-core/src/interfaces/retrypolicy/#isretryable)

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

#### Implementation of

[`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/).[`shouldRetry`](/api/retry-core/src/interfaces/retrypolicy/#shouldretry)
