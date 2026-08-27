---
editUrl: false
next: false
prev: false
title: "TypedWorkflowReference"
---

> **TypedWorkflowReference**\<`TPayload`, `TSteps`\> = [`WorkflowOptions`](/api/workflow-core/src/type-aliases/workflowoptions/) & `object`

## Type Declaration

### \[TYPED_WORKFLOW_CONTRACT\]?

> `readonly` `optional` **\[TYPED_WORKFLOW_CONTRACT\]?**: `object`

#### \[TYPED_WORKFLOW_CONTRACT\].payload

> `readonly` **payload**: `TPayload`

#### \[TYPED_WORKFLOW_CONTRACT\].steps

> `readonly` **steps**: `TSteps`

### name

> `readonly` **name**: `string`

## Type Parameters

### TPayload

`TPayload`

### TSteps

`TSteps` _extends_ readonly [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)[]
