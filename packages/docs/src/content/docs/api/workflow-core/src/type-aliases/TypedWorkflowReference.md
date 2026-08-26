---
editUrl: false
next: false
prev: false
title: "TypedWorkflowReference"
---

> **TypedWorkflowReference**\<`TPayload`, `TSteps`\> = [`WorkflowOptions`](/api/workflow-core/src/type-aliases/workflowoptions/) & `object`

## Type Declaration

### \[TYPED\_WORKFLOW\_CONTRACT\]?

> `readonly` `optional` **\[TYPED\_WORKFLOW\_CONTRACT\]?**: `object`

#### \[TYPED\_WORKFLOW\_CONTRACT\].payload

> `readonly` **payload**: `TPayload`

#### \[TYPED\_WORKFLOW\_CONTRACT\].steps

> `readonly` **steps**: `TSteps`

### name

> `readonly` **name**: `string`

## Type Parameters

### TPayload

`TPayload`

### TSteps

`TSteps` *extends* readonly [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)[]
