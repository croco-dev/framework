---
editUrl: false
next: false
prev: false
title: "ExponentialBackoff"
---

Exponential backoff with Full Jitter.

Implements AWS-recommended pattern to prevent Thundering Herd:
cap = min(maxDelay, delay \* multiplier^attempt)
sleep = random(0, cap)

## See

https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

## Implements

- [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)

## Constructors

### Constructor

> **new ExponentialBackoff**(`options?`, `deps?`): `ExponentialBackoff`

#### Parameters

##### options?

[`BackoffOptions`](/api/retry-core/src/interfaces/backoffoptions/) = `{}`

##### deps?

[`BackoffDependencies`](/api/retry-core/src/interfaces/backoffdependencies/) = `{}`

#### Returns

`ExponentialBackoff`

## Properties

### supportsAbortSignal

> `readonly` **supportsAbortSignal**: `boolean`

Whether this policy guarantees that wait stops when its signal aborts.

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`supportsAbortSignal`](/api/retry-core/src/interfaces/backoffpolicy/#supportsabortsignal)

## Methods

### getDelay()

> **getDelay**(`attempt`): `number`

Calculate delay for attempt (0-based index).

Without jitter: min(maxDelay, delay \* multiplier^attempt)
With jitter: random(0, cap) - Full Jitter

#### Parameters

##### attempt

`number`

#### Returns

`number`

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`getDelay`](/api/retry-core/src/interfaces/backoffpolicy/#getdelay)

---

### reset()

> **reset**(): `void`

Reset (no-op for stateless implementation).

#### Returns

`void`

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`reset`](/api/retry-core/src/interfaces/backoffpolicy/#reset)

---

### wait()

> **wait**(`attempt`, `signal?`): `Promise`\<`void`\>

Wait for the calculated delay.

#### Parameters

##### attempt

`number`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`wait`](/api/retry-core/src/interfaces/backoffpolicy/#wait)
