---
editUrl: false
next: false
prev: false
title: "createOperation"
---

> **createOperation**\<`Input`, `Output`, `Context`, `Kind`\>(`definition`, `handler`): [`Operation`](/api/protocols-core/src/type-aliases/operation/)\<`Input`, `Output`, `Context`, `Kind`\>

Bind a typed function handler to an authorized operation contract.

## Type Parameters

### Input

`Input` _extends_ `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>

### Output

`Output` _extends_ `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>

### Context

`Context`

### Kind

`Kind` _extends_ `"query"` \| `"command"` = `"query"` \| `"command"`

## Parameters

### definition

[`OperationDefinition`](/api/protocols-core/src/type-aliases/operationdefinition/)\<`Input`, `Output`, `Context`, `Kind`\>

### handler

[`OperationHandler`](/api/protocols-core/src/type-aliases/operationhandler/)\<`NoInfer`\<`Input`\>, `NoInfer`\<`Output`\>, `NoInfer`\<`Context`\>\>

## Returns

[`Operation`](/api/protocols-core/src/type-aliases/operation/)\<`Input`, `Output`, `Context`, `Kind`\>
