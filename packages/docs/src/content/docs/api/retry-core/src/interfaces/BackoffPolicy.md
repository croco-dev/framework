---
editUrl: false
next: false
prev: false
title: "BackoffPolicy"
---

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:23](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/BackoffPolicy.ts#L23)

Backoff policy interface.

## Type Parameters

### T

`T` = `unknown`

Backoff 구현체의 추가 옵션 타입

## Properties

### options?

> `readonly` `optional` **options**: `T`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:34](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/BackoffPolicy.ts#L34)

Backoff 구현체의 추가 옵션 (구현체에 따라 다름)

## Methods

### getDelay()

> **getDelay**(`attempt`): `number`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:25](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/BackoffPolicy.ts#L25)

Calculate delay for the given attempt (0-based)

#### Parameters

##### attempt

`number`

#### Returns

`number`

***

### reset()

> **reset**(): `void`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:31](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/BackoffPolicy.ts#L31)

Reset internal state if any

#### Returns

`void`

***

### wait()

> **wait**(`attempt`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:28](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/BackoffPolicy.ts#L28)

Wait for the calculated delay

#### Parameters

##### attempt

`number`

#### Returns

`Promise`\<`void`\>
