---
editUrl: false
next: false
prev: false
title: "WorkflowStepInputResolver"
---

> **WorkflowStepInputResolver**\<`TPayload`, `TPreviousResults`, `TInput`\> = (`context`) => `TInput`

## Type Parameters

### TPayload

`TPayload` = `unknown`

### TPreviousResults

`TPreviousResults` _extends_ readonly [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)[] = readonly [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)[]

### TInput

`TInput` = `unknown`

## Parameters

### context

[`WorkflowStepContext`](/api/workflow-core/src/type-aliases/workflowstepcontext/)\<`TPayload`, `TPreviousResults`\>

## Returns

`TInput`
