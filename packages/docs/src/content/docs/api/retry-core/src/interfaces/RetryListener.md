---
editUrl: false
next: false
prev: false
title: "RetryListener"
---

Listener interface for retry lifecycle events.
Implement this to add logging, metrics, or custom behavior.

## Methods

### onError()?

> `optional` **onError**(`context`, `error`): `void` \| `Promise`\<`void`\>

Called after each failed attempt (before backoff).

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

##### error

`Error`

#### Returns

`void` \| `Promise`\<`void`\>

***

### onExhausted()?

> `optional` **onExhausted**(`context`): `void` \| `Promise`\<`void`\>

Called when all retry attempts are exhausted.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`void` \| `Promise`\<`void`\>

***

### onStart()?

> `optional` **onStart**(`context`): `boolean` \| `Promise`\<`boolean`\>

Called before the first attempt.
Return false to veto the retry operation.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`boolean` \| `Promise`\<`boolean`\>

***

### onSuccess()?

> `optional` **onSuccess**(`context`): `void` \| `Promise`\<`void`\>

Called after a successful attempt.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`void` \| `Promise`\<`void`\>
