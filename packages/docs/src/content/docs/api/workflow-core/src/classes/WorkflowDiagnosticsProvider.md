---
editUrl: false
next: false
prev: false
title: "WorkflowDiagnosticsProvider"
---

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new WorkflowDiagnosticsProvider**(`executionManager`, `registry?`, `options?`): `WorkflowDiagnosticsProvider`

#### Parameters

##### executionManager

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/)

##### registry?

[`WorkflowRegistry`](/api/workflow-core/src/classes/workflowregistry/) = `...`

##### options?

[`WorkflowDiagnosticsProviderOptions`](/api/workflow-core/src/type-aliases/workflowdiagnosticsprovideroptions/) = `{}`

#### Returns

`WorkflowDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"workflow"` = `"workflow"`

#### Implementation of

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/).[`name`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/#name)

## Methods

### getHealth()

> **getHealth**(`signal?`): `Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>

#### Implementation of

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/).[`getHealth`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/#gethealth)
