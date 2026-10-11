---
editUrl: false
next: false
prev: false
title: "policySemanticDiff"
---

> **policySemanticDiff**\<`TValue`, `TContext`, `TResult`\>(`policy`, `before`, `after`): readonly [`PolicySemanticDiff`](/api/features-core/src/type-aliases/policysemanticdiff/)[]

## Type Parameters

### TValue

`TValue`

### TContext

`TContext` _extends_ `Readonly`\<`Record`\<`string`, `unknown`\>\> = `Readonly`\<`Record`\<`string`, `unknown`\>\>

### TResult

`TResult` = `unknown`

## Parameters

### policy

[`ParameterizedPolicy`](/api/features-core/src/type-aliases/parameterizedpolicy/)\<`TValue`, `TContext`, `TResult`\>

### before

`TValue` \| `null`

### after

`TValue`

## Returns

readonly [`PolicySemanticDiff`](/api/features-core/src/type-aliases/policysemanticdiff/)[]
