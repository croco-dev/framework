---
editUrl: false
next: false
prev: false
title: "createOperation"
---

> **createOperation**\<`Input`, `Output`, `Context`, `Kind`\>(`definition`, `handler`): [`Operation`](/api/protocols-core/src/type-aliases/operation/)\<`Input`, `Output`, `Context`, `Kind`\>

Bind either a function or a generated class-method factory to the same contract.

## Type Parameters

### Input

`Input` _extends_ `ZodType`\<`any`, `ZodTypeDef`, `any`\>

### Output

`Output` _extends_ `ZodType`\<`any`, `ZodTypeDef`, `any`\>

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
