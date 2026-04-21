---
editUrl: false
next: false
prev: false
title: "LambdaTimeoutGuard"
---

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:102](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L102)

Create a timeout-aware wrapper for retry operations.
Throws if not enough time remains.

## Constructors

### Constructor

> **new LambdaTimeoutGuard**(`options?`): `LambdaTimeoutGuard`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:106](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L106)

#### Parameters

##### options?

[`TimeoutGuardOptions`](/api/retry-core/src/interfaces/timeoutguardoptions/) = `{}`

#### Returns

`LambdaTimeoutGuard`

## Methods

### checkTimeout()

> **checkTimeout**(`nextDelayMs`): `void`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:116](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L116)

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

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:133](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L133)

Get remaining time in milliseconds.

#### Returns

`number`
