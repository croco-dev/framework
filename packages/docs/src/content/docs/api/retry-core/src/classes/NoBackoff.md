---
editUrl: false
next: false
prev: false
title: "NoBackoff"
---

No delay backoff (for testing or immediate retry scenarios).

## Implements

- [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)

## Constructors

### Constructor

> **new NoBackoff**(): `NoBackoff`

#### Returns

`NoBackoff`

## Properties

### supportsAbortSignal

> `readonly` **supportsAbortSignal**: `true` = `true`

Whether this policy guarantees that wait stops when its signal aborts.

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`supportsAbortSignal`](/api/retry-core/src/interfaces/backoffpolicy/#supportsabortsignal)

## Methods

### getDelay()

> **getDelay**(`_attempt`): `number`

Calculate delay for the given attempt (0-based)

#### Parameters

##### \_attempt

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

> **wait**(`_attempt`, `_signal?`): `Promise`\<`void`\>

Wait for the calculated delay, cancelling promptly when the signal aborts.

#### Parameters

##### \_attempt

`number`

##### \_signal?

`AbortSignal`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`wait`](/api/retry-core/src/interfaces/backoffpolicy/#wait)
