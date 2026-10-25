---
editUrl: false
next: false
prev: false
title: "createRestOperationController"
---

> **createRestOperationController**\<`Input`, `Output`, `Context`, `Kind`\>(`operation`, `binding`): [`Constructor`](/api/protocols-rest/src/type-aliases/constructor/)

Explicit REST export of a function operation through the existing controller/route graph.
Creating an operation alone never exposes a network surface.

## Type Parameters

### Input

`Input` _extends_ `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>

### Output

`Output` _extends_ `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>

### Context

`Context`

### Kind

`Kind` _extends_ `"query"` \| `"command"`

## Parameters

### operation

[`Operation`](/api/protocols-core/src/type-aliases/operation/)\<`Input`, `Output`, `Context`, `Kind`\>

### binding

[`RestOperationBinding`](/api/protocols-rest/src/type-aliases/restoperationbinding/)\<`Context`, `NoInfer`\<`Kind`\>\>

## Returns

[`Constructor`](/api/protocols-rest/src/type-aliases/constructor/)
