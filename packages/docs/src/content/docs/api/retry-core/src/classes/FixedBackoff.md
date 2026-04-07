---
editUrl: false
next: false
prev: false
title: "FixedBackoff"
---

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:119](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/BackoffPolicy.ts#L119)

Fixed delay backoff (no exponential growth).

## Implements

- [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)

## Constructors

### Constructor

> **new FixedBackoff**(`delayMs?`, `deps?`): `FixedBackoff`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:123](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/BackoffPolicy.ts#L123)

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

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:128](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/BackoffPolicy.ts#L128)

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

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:136](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/BackoffPolicy.ts#L136)

Reset internal state if any

#### Returns

`void`

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`reset`](/api/retry-core/src/interfaces/backoffpolicy/#reset)

***

### wait()

> **wait**(`_attempt`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:132](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/BackoffPolicy.ts#L132)

Wait for the calculated delay

#### Parameters

##### \_attempt

`number`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`wait`](/api/retry-core/src/interfaces/backoffpolicy/#wait)
