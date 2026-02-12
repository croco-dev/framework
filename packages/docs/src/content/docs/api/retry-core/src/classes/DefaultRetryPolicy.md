---
editUrl: false
next: false
prev: false
title: "DefaultRetryPolicy"
---

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:51](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/RetryPolicy.ts#L51)

Default retry policy with ProblemCategory support.

## Implements

- [`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/)

## Constructors

### Constructor

> **new DefaultRetryPolicy**(`options?`): `DefaultRetryPolicy`

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:56](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/RetryPolicy.ts#L56)

#### Parameters

##### options?

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/) = `{}`

#### Returns

`DefaultRetryPolicy`

## Methods

### shouldRetry()

> **shouldRetry**(`error`, `attempt`, `maxAttempts`): `boolean`

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:62](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/RetryPolicy.ts#L62)

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
