---
editUrl: false
next: false
prev: false
title: "RetryListener"
---

Defined in: [packages/retry-core/src/libs/RetryListener.ts:7](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/RetryListener.ts#L7)

Listener interface for retry lifecycle events.
Implement this to add logging, metrics, or custom behavior.

## Methods

### onError()?

> `optional` **onError**(`context`, `error`): `void` \| `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/RetryListener.ts:17](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/RetryListener.ts#L17)

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

Defined in: [packages/retry-core/src/libs/RetryListener.ts:27](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/RetryListener.ts#L27)

Called when all retry attempts are exhausted.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`void` \| `Promise`\<`void`\>

***

### onStart()?

> `optional` **onStart**(`context`): `boolean` \| `Promise`\<`boolean`\>

Defined in: [packages/retry-core/src/libs/RetryListener.ts:12](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/RetryListener.ts#L12)

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

Defined in: [packages/retry-core/src/libs/RetryListener.ts:22](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/RetryListener.ts#L22)

Called after a successful attempt.

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`void` \| `Promise`\<`void`\>
