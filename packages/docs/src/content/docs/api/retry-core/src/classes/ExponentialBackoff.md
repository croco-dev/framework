---
editUrl: false
next: false
prev: false
title: "ExponentialBackoff"
---

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:56](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L56)

Exponential backoff with Full Jitter.

Implements AWS-recommended pattern to prevent Thundering Herd:
cap = min(maxDelay, delay * multiplier^attempt)
sleep = random(0, cap)

## See

https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

## Implements

- [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)

## Constructors

### Constructor

> **new ExponentialBackoff**(`options?`, `deps?`): `ExponentialBackoff`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:64](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L64)

#### Parameters

##### options?

[`BackoffOptions`](/api/retry-core/src/interfaces/backoffoptions/) = `{}`

##### deps?

[`BackoffDependencies`](/api/retry-core/src/interfaces/backoffdependencies/) = `{}`

#### Returns

`ExponentialBackoff`

## Methods

### getDelay()

> **getDelay**(`attempt`): `number`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:81](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L81)

Calculate delay for attempt (0-based index).

Without jitter: min(maxDelay, delay * multiplier^attempt)
With jitter: random(0, cap) - Full Jitter

#### Parameters

##### attempt

`number`

#### Returns

`number`

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`getDelay`](/api/retry-core/src/interfaces/backoffpolicy/#getdelay)

***

### reset()

> **reset**(): `void`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:106](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L106)

Reset (no-op for stateless implementation).

#### Returns

`void`

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`reset`](/api/retry-core/src/interfaces/backoffpolicy/#reset)

***

### wait()

> **wait**(`attempt`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:96](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L96)

Wait for the calculated delay.

#### Parameters

##### attempt

`number`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`wait`](/api/retry-core/src/interfaces/backoffpolicy/#wait)
