---
editUrl: false
next: false
prev: false
title: "BackoffPolicy"
---

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:21](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L21)

Backoff policy interface.

## Methods

### getDelay()

> **getDelay**(`attempt`): `number`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:23](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L23)

Calculate delay for the given attempt (0-based)

#### Parameters

##### attempt

`number`

#### Returns

`number`

***

### reset()

> **reset**(): `void`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:29](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L29)

Reset internal state if any

#### Returns

`void`

***

### wait()

> **wait**(`attempt`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:26](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L26)

Wait for the calculated delay

#### Parameters

##### attempt

`number`

#### Returns

`Promise`\<`void`\>
