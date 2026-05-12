---
editUrl: false
next: false
prev: false
title: "CompositeRetryListener"
---

Composite listener that delegates to multiple listeners.

## Implements

- [`RetryListener`](/api/retry-core/src/interfaces/retrylistener/)

## Constructors

### Constructor

> **new CompositeRetryListener**(`listeners`): `CompositeRetryListener`

#### Parameters

##### listeners

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/)[]

#### Returns

`CompositeRetryListener`

## Methods

### onError()

> **onError**(`context`, `error`): `Promise`\<`void`\>

Called after each failed attempt (before backoff).

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

##### error

`Error`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onError`](/api/retry-core/src/interfaces/retrylistener/#onerror)

---

### onExhausted()

> **onExhausted**(`context`): `Promise`\<`void`\>

Called when all retry attempts are exhausted.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onExhausted`](/api/retry-core/src/interfaces/retrylistener/#onexhausted)

---

### onStart()

> **onStart**(`context`): `Promise`\<`boolean`\>

Called before the first attempt.
Return false to veto the retry operation.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onStart`](/api/retry-core/src/interfaces/retrylistener/#onstart)

---

### onSuccess()

> **onSuccess**(`context`): `Promise`\<`void`\>

Called after a successful attempt.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onSuccess`](/api/retry-core/src/interfaces/retrylistener/#onsuccess)
