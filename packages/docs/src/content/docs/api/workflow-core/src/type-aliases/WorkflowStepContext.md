---
editUrl: false
next: false
prev: false
title: "WorkflowStepContext"
---

> **WorkflowStepContext**\<`TPayload`, `TPreviousResults`\> = `object`

## Type Parameters

### TPayload

`TPayload` = `unknown`

### TPreviousResults

`TPreviousResults` _extends_ readonly [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)[] = readonly [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)[]

## Properties

### payload

> `readonly` **payload**: `TPayload`

---

### previousResults

> `readonly` **previousResults**: `TPreviousResults`

---

### step

> `readonly` **step**: [`WorkflowTaskStep`](/api/workflow-core/src/type-aliases/workflowtaskstep/)

---

### workflow

> `readonly` **workflow**: [`WorkflowDefinition`](/api/workflow-core/src/type-aliases/workflowdefinition/)

---

### workflowExecutionId

> `readonly` **workflowExecutionId**: `string`
