---
editUrl: false
next: false
prev: false
title: "RetryHooks"
---

## Properties

### beforeWait?

> `optional` **beforeWait?**: (`delay`, `context`) => `boolean` \| `Promise`\<`boolean`\>

#### Parameters

##### delay

`number`

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`boolean` \| `Promise`\<`boolean`\>

***

### onExhausted?

> `optional` **onExhausted?**: (`error`, `context`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### error

`Error`

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`void` \| `Promise`\<`void`\>

***

### onRetryError?

> `optional` **onRetryError?**: (`error`, `context`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### error

`Error`

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`void` \| `Promise`\<`void`\>

***

### onStart?

> `optional` **onStart?**: (`context`) => `boolean` \| `Promise`\<`boolean`\>

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`boolean` \| `Promise`\<`boolean`\>

***

### onSuccess?

> `optional` **onSuccess?**: (`context`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### Returns

`void` \| `Promise`\<`void`\>
