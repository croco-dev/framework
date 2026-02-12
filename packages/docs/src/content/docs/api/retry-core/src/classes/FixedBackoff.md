---
editUrl: false
next: false
prev: false
title: "FixedBackoff"
---

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:114](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L114)

Fixed delay backoff (no exponential growth).

## Implements

- [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)

## Constructors

### Constructor

> **new FixedBackoff**(`delayMs?`, `deps?`): `FixedBackoff`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:118](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L118)

#### Parameters

##### delayMs?

`number` = `DEFAULT_DELAY`

##### deps?

[`BackoffDependencies`](/api/retry-core/src/interfaces/backoffdependencies/) = `{}`

#### Returns

`FixedBackoff`

## Methods

### getDelay()

> **getDelay**(`_attempt`): `number`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:123](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L123)

Calculate delay for the given attempt (0-based)

#### Parameters

##### \_attempt

`number`

#### Returns

`number`

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`getDelay`](/api/retry-core/src/interfaces/backoffpolicy/#getdelay)

***

### reset()

> **reset**(): `void`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:131](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L131)

Reset internal state if any

#### Returns

`void`

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`reset`](/api/retry-core/src/interfaces/backoffpolicy/#reset)

***

### wait()

> **wait**(`_attempt`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:127](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L127)

Wait for the calculated delay

#### Parameters

##### \_attempt

`number`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`wait`](/api/retry-core/src/interfaces/backoffpolicy/#wait)
