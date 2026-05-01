---
editUrl: false
next: false
prev: false
title: "DefaultRetryPolicy"
---

Default retry policy with ProblemCategory support.

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

### shouldRetry()

> **shouldRetry**(`error`, `attempt`, `maxAttempts`): `boolean`

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

#### Implementation of

[`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/).[`shouldRetry`](/api/retry-core/src/interfaces/retrypolicy/#shouldretry)
