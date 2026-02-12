---
editUrl: false
next: false
prev: false
title: "LambdaTimeoutGuard"
---

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:90](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L90)

Create a timeout-aware wrapper for retry operations.
Throws if not enough time remains.

## Constructors

### Constructor

> **new LambdaTimeoutGuard**(`options?`): `LambdaTimeoutGuard`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:94](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L94)

#### Parameters

##### options?

[`TimeoutGuardOptions`](/api/retry-core/src/interfaces/timeoutguardoptions/) = `{}`

#### Returns

`LambdaTimeoutGuard`

## Methods

### checkTimeout()

> **checkTimeout**(`nextDelayMs`): `void`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:104](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L104)

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

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:119](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L119)

Get remaining time in milliseconds.

#### Returns

`number`
