---
editUrl: false
next: false
prev: false
title: "NoBackoff"
---

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:139](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/BackoffPolicy.ts#L139)

No delay backoff (for testing or immediate retry scenarios).

## Implements

- [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)

## Constructors

### Constructor

> **new NoBackoff**(): `NoBackoff`

#### Returns

`NoBackoff`

## Methods

### getDelay()

> **getDelay**(`_attempt`): `number`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:140](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/BackoffPolicy.ts#L140)

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

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:148](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/BackoffPolicy.ts#L148)

Reset internal state if any

#### Returns

`void`

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`reset`](/api/retry-core/src/interfaces/backoffpolicy/#reset)

***

### wait()

> **wait**(`_attempt`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:144](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/BackoffPolicy.ts#L144)

Wait for the calculated delay

#### Parameters

##### \_attempt

`number`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/).[`wait`](/api/retry-core/src/interfaces/backoffpolicy/#wait)
