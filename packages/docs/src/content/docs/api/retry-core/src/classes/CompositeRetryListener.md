---
editUrl: false
next: false
prev: false
title: "CompositeRetryListener"
---

Defined in: [packages/retry-core/src/libs/RetryListener.ts:33](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/RetryListener.ts#L33)

Composite listener that delegates to multiple listeners.

## Implements

- [`RetryListener`](/api/retry-core/src/interfaces/retrylistener/)

## Constructors

### Constructor

> **new CompositeRetryListener**(`listeners`): `CompositeRetryListener`

Defined in: [packages/retry-core/src/libs/RetryListener.ts:34](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/RetryListener.ts#L34)

#### Parameters

##### listeners

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/)[]

#### Returns

`CompositeRetryListener`

## Methods

### onError()

> **onError**(`context`, `error`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/RetryListener.ts:46](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/RetryListener.ts#L46)

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

***

### onExhausted()

> **onExhausted**(`context`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/RetryListener.ts:62](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/RetryListener.ts#L62)

Called when all retry attempts are exhausted.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onExhausted`](/api/retry-core/src/interfaces/retrylistener/#onexhausted)

***

### onStart()

> **onStart**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/retry-core/src/libs/RetryListener.ts:36](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/RetryListener.ts#L36)

Called before the first attempt.
Return false to veto the retry operation.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onStart`](/api/retry-core/src/interfaces/retrylistener/#onstart)

***

### onSuccess()

> **onSuccess**(`context`): `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/RetryListener.ts:54](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/RetryListener.ts#L54)

Called after a successful attempt.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RetryListener`](/api/retry-core/src/interfaces/retrylistener/).[`onSuccess`](/api/retry-core/src/interfaces/retrylistener/#onsuccess)
