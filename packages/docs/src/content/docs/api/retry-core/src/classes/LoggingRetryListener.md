---
editUrl: false
next: false
prev: false
title: "LoggingRetryListener"
---

Simple logging listener for debugging.

## Implements

- [`RetryListener`](/api/retry-core/src/interfaces/retrylistener/)

## Constructors

### Constructor

> **new LoggingRetryListener**(`logger?`): `LoggingRetryListener`

#### Parameters

##### logger?

`Pick`\<`Console`, `"log"` \| `"warn"` \| `"error"`\> = `console`

#### Returns

`LoggingRetryListener`

## Methods

### onError()

> **onError**(`context`, `error`): `void`

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

---

### onExhausted()

> **onExhausted**(`context`): `void`

Called when all retry attempts are exhausted.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`void`

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onExhausted`](/api/retry-core/src/interfaces/retrylistener/#onexhausted)

---

### onStart()

> **onStart**(`context`): `boolean`

Called before the first attempt.
Return false to veto the retry operation.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`boolean`

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onStart`](/api/retry-core/src/interfaces/retrylistener/#onstart)

---

### onSuccess()

> **onSuccess**(`context`): `void`

Called after a successful attempt.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`void`

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onSuccess`](/api/retry-core/src/interfaces/retrylistener/#onsuccess)
