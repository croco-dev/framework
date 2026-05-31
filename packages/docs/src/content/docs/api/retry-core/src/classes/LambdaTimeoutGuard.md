---
editUrl: false
next: false
prev: false
title: "LambdaTimeoutGuard"
---

Create a timeout-aware wrapper for retry operations.
Throws if not enough time remains.

## Constructors

### Constructor

> **new LambdaTimeoutGuard**(`options?`): `LambdaTimeoutGuard`

#### Parameters

##### options?

[`TimeoutGuardOptions`](/api/retry-core/src/interfaces/timeoutguardoptions/) = `{}`

#### Returns

`LambdaTimeoutGuard`

## Methods

### checkTimeout()

> **checkTimeout**(`nextDelayMs`): `void`

Check if retry should continue.

#### Parameters

##### nextDelayMs

`number`

Expected delay for next attempt

#### Returns

`void`

#### Throws

Error if not enough time

---

### getRemainingTimeMs()

> **getRemainingTimeMs**(): `number`

Get remaining time in milliseconds.

#### Returns

`number`
