---
editUrl: false
next: false
prev: false
title: "ExponentialBackoff"
---

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:61](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/BackoffPolicy.ts#L61)

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

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:69](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/BackoffPolicy.ts#L69)

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

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:86](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/BackoffPolicy.ts#L86)

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

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:111](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/BackoffPolicy.ts#L111)

Reset (no-op for stateless implementation).

#### Returns

`void`

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`reset`](/api/retry-core/src/interfaces/backoffpolicy/#reset)

***

### wait()

> **wait**(`attempt`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:101](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/BackoffPolicy.ts#L101)

Wait for the calculated delay.

#### Parameters

##### attempt

`number`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`wait`](/api/retry-core/src/interfaces/backoffpolicy/#wait)
