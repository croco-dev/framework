---
editUrl: false
next: false
prev: false
title: "LoggingRetryListener"
---

Defined in: [packages/retry-core/src/libs/RetryListener.ts:74](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/RetryListener.ts#L74)

Simple logging listener for debugging.

## Implements

- [`RetryListener`](/api/retry-core/src/interfaces/retrylistener/)

## Constructors

### Constructor

> **new LoggingRetryListener**(`logger?`): `LoggingRetryListener`

Defined in: [packages/retry-core/src/libs/RetryListener.ts:75](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/RetryListener.ts#L75)

#### Parameters

##### logger?

`Pick`\<`Console`, `"log"` \| `"warn"` \| `"error"`\> = `console`

#### Returns

`LoggingRetryListener`

## Methods

### onError()

> **onError**(`context`, `error`): `void`

Defined in: [packages/retry-core/src/libs/RetryListener.ts:82](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/RetryListener.ts#L82)

Called after each failed attempt (before backoff).

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

##### error

`Error`

#### Returns

`void`

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onError`](/api/retry-core/src/interfaces/retrylistener/#onerror)

***

### onExhausted()

> **onExhausted**(`context`): `void`

Defined in: [packages/retry-core/src/libs/RetryListener.ts:90](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/RetryListener.ts#L90)

Called when all retry attempts are exhausted.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`void`

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onExhausted`](/api/retry-core/src/interfaces/retrylistener/#onexhausted)

***

### onStart()

> **onStart**(`context`): `boolean`

Defined in: [packages/retry-core/src/libs/RetryListener.ts:77](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/RetryListener.ts#L77)

Called before the first attempt.
Return false to veto the retry operation.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`boolean`

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onStart`](/api/retry-core/src/interfaces/retrylistener/#onstart)

***

### onSuccess()

> **onSuccess**(`context`): `void`

Defined in: [packages/retry-core/src/libs/RetryListener.ts:86](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/RetryListener.ts#L86)

Called after a successful attempt.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`void`

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onSuccess`](/api/retry-core/src/interfaces/retrylistener/#onsuccess)
