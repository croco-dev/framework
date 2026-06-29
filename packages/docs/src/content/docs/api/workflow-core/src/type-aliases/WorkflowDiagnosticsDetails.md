---
editUrl: false
next: false
prev: false
title: "WorkflowDiagnosticsDetails"
---

> **WorkflowDiagnosticsDetails** = `object`

## Properties

### attentionExecutionCount?

> `readonly` `optional` **attentionExecutionCount?**: `number`

***

### executionCount?

> `readonly` `optional` **executionCount?**: `number`

***

### executionsByStatus?

> `readonly` `optional` **executionsByStatus?**: `Record`\<[`ExecutionStatus`](/api/execution-core/src/type-aliases/executionstatus/), `number`\>

***

### inspectionSupported

> `readonly` **inspectionSupported**: `boolean`

***

### latestExecutions?

> `readonly` `optional` **latestExecutions?**: readonly [`WorkflowDiagnosticsExecutionDetails`](/api/workflow-core/src/type-aliases/workflowdiagnosticsexecutiondetails/)[]

***

### registeredWorkflowCount

> `readonly` **registeredWorkflowCount**: `number`

***

### workflows

> `readonly` **workflows**: readonly [`WorkflowDiagnosticsWorkflowDetails`](/api/workflow-core/src/type-aliases/workflowdiagnosticsworkflowdetails/)[]
