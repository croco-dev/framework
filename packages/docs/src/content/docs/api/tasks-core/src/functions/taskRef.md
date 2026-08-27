---
editUrl: false
next: false
prev: false
title: "taskRef"
---

> **taskRef**\<`TTarget`, `TMethodName`, `TName`\>(`target`, `methodName`, `name`): [`TaskReference`](/api/tasks-core/src/type-aliases/taskreference/)\<`TaskMethodPayload`\<`TTarget`\[`TMethodName`\]\>, `TaskMethodResult`\<`TTarget`\[`TMethodName`\]\>, `TName`\>

Creates a runtime task reference whose payload and result types are inferred from the handler.

## Type Parameters

### TTarget

`TTarget` *extends* `object`

### TMethodName

`TMethodName` *extends* `string`

### TName

`TName` *extends* `string`

## Parameters

### target

`TaskTarget`\<`TTarget`\>

### methodName

`TMethodName`

### name

`TName`

## Returns

[`TaskReference`](/api/tasks-core/src/type-aliases/taskreference/)\<`TaskMethodPayload`\<`TTarget`\[`TMethodName`\]\>, `TaskMethodResult`\<`TTarget`\[`TMethodName`\]\>, `TName`\>
