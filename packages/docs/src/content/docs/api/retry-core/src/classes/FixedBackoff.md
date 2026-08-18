---
editUrl: false
next: false
prev: false
title: "FixedBackoff"
---

Fixed delay backoff (no exponential growth).

## Implements

- [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)

## Constructors

### Constructor

> **new FixedBackoff**(`delayMs?`, `deps?`): `FixedBackoff`

#### Parameters

##### delayMs?

`number` = `DEFAULT_DELAY`

##### deps?

[`BackoffDependencies`](/api/retry-core/src/interfaces/backoffdependencies/) = `{}`

#### Returns

`FixedBackoff`

## Properties

### supportsAbortSignal

> `readonly` **supportsAbortSignal**: `boolean`

Whether this policy guarantees that wait stops when its signal aborts.

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`supportsAbortSignal`](/api/retry-core/src/interfaces/backoffpolicy/#supportsabortsignal)

## Methods

### getDelay()

> **getDelay**(`attempt`): `number`

Calculate delay for the given attempt (0-based)

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

Reset internal state if any

#### Returns

`void`

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`reset`](/api/retry-core/src/interfaces/backoffpolicy/#reset)

---

### wait()

> **wait**(`attempt`, `signal?`): `Promise`\<`void`\>

Wait for the calculated delay, cancelling promptly when the signal aborts.

#### Parameters

##### attempt

`number`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`wait`](/api/retry-core/src/interfaces/backoffpolicy/#wait)
