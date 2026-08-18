---
editUrl: false
next: false
prev: false
title: "JobsOperations"
---

## Methods

### cancel()

> **cancel**(`id`, `params?`): `Promise`\<[`JobDetails`](/api/execution-core/src/type-aliases/jobdetails/)\>

#### Parameters

##### id

`string`

##### params?

[`CancelJobParams`](/api/execution-core/src/type-aliases/canceljobparams/)

#### Returns

`Promise`\<[`JobDetails`](/api/execution-core/src/type-aliases/jobdetails/)\>

***

### list()

> **list**(`options?`): `Promise`\<[`JobListReport`](/api/execution-core/src/type-aliases/joblistreport/)\>

#### Parameters

##### options?

[`ListExecutionsOptions`](/api/execution-core/src/interfaces/listexecutionsoptions/)

#### Returns

`Promise`\<[`JobListReport`](/api/execution-core/src/type-aliases/joblistreport/)\>

***

### logs()

> **logs**(`id`): `Promise`\<readonly [`ExecutionLogEntry`](/api/execution-core/src/interfaces/executionlogentry/)[]\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<readonly [`ExecutionLogEntry`](/api/execution-core/src/interfaces/executionlogentry/)[]\>

***

### replay()

> **replay**(`id`, `params?`): `Promise`\<[`JobDetails`](/api/execution-core/src/type-aliases/jobdetails/)\>

#### Parameters

##### id

`string`

##### params?

[`ReplayExecutionParams`](/api/execution-core/src/interfaces/replayexecutionparams/)

#### Returns

`Promise`\<[`JobDetails`](/api/execution-core/src/type-aliases/jobdetails/)\>

***

### show()

> **show**(`id`): `Promise`\<[`JobDetails`](/api/execution-core/src/type-aliases/jobdetails/)\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`JobDetails`](/api/execution-core/src/type-aliases/jobdetails/)\>
