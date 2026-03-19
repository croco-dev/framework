---
editUrl: false
next: false
prev: false
title: "LifecycleHooks"
---

Defined in: [packages/framework-context/src/libs/types.ts:55](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/types.ts#L55)

Lifecycle hooks for request scope

## Type Parameters

### TContext

`TContext` = [`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

## Properties

### onRequestEnd()?

> `optional` **onRequestEnd**: (`ctx`, `result?`) => `void` \| `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/types.ts:64](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/types.ts#L64)

Called when request ends successfully, after middleware chain

#### Parameters

##### ctx

`TContext`

##### result?

`unknown`

#### Returns

`void` \| `Promise`\<`void`\>

***

### onRequestError()?

> `optional` **onRequestError**: (`ctx`, `error`) => `void` \| `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/types.ts:69](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/types.ts#L69)

Called when request encounters an error

#### Parameters

##### ctx

`TContext`

##### error

`Error`

#### Returns

`void` \| `Promise`\<`void`\>

***

### onRequestStart()?

> `optional` **onRequestStart**: (`ctx`) => `void` \| `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/types.ts:59](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/types.ts#L59)

Called when request starts, before middleware chain

#### Parameters

##### ctx

`TContext`

#### Returns

`void` \| `Promise`\<`void`\>
