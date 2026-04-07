---
editUrl: false
next: false
prev: false
title: "LambdaTimeoutGuard"
---

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:99](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L99)

Create a timeout-aware wrapper for retry operations.
Throws if not enough time remains.

## Constructors

### Constructor

> **new LambdaTimeoutGuard**(`options?`): `LambdaTimeoutGuard`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:103](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L103)

#### Parameters

##### options?

[`TimeoutGuardOptions`](/api/retry-core/src/interfaces/timeoutguardoptions/) = `{}`

#### Returns

`LambdaTimeoutGuard`

## Methods

### checkTimeout()

> **checkTimeout**(`nextDelayMs`): `void`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:113](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L113)

Check if retry should continue.

#### Parameters

##### nextDelayMs

`number`

Expected delay for next attempt

#### Returns

`void`

#### Throws

Error if not enough time

***

### getRemainingTimeMs()

> **getRemainingTimeMs**(): `number`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:130](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L130)

Get remaining time in milliseconds.

#### Returns

`number`
