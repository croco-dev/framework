---
editUrl: false
next: false
prev: false
title: "Middleware"
---

> **Middleware**\<`TContext`\> = (`ctx`, `next`) => `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/types.ts:50](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/framework-context/src/libs/types.ts#L50)

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
