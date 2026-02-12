---
editUrl: false
next: false
prev: false
title: "Middleware"
---

> **Middleware**\<`TContext`\> = (`ctx`, `next`) => `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/types.ts:50](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/framework-context/src/libs/types.ts#L50)

Onion middleware function type
Similar to Koa middleware pattern

## Type Parameters

### TContext

`TContext` = [`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

## Parameters

### ctx

`TContext`

### next

() => `Promise`\<`void`\>

## Returns

`Promise`\<`void`\>
