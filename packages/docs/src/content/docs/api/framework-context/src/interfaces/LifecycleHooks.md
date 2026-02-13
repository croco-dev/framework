---
editUrl: false
next: false
prev: false
title: "LifecycleHooks"
---

Defined in: [packages/framework-context/src/libs/types.ts:100](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/framework-context/src/libs/types.ts#L100)

Lifecycle hooks for request scope

## Type Parameters

### TContext

`TContext` = [`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

## Properties

### onRequestEnd()?

> `optional` **onRequestEnd**: (`ctx`, `result?`) => `void` \| `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/types.ts:109](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/framework-context/src/libs/types.ts#L109)

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

Defined in: [packages/framework-context/src/libs/types.ts:114](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/framework-context/src/libs/types.ts#L114)

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

Defined in: [packages/framework-context/src/libs/types.ts:104](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/framework-context/src/libs/types.ts#L104)

Called when request starts, before middleware chain

#### Parameters

##### ctx

`TContext`

#### Returns

`void` \| `Promise`\<`void`\>
