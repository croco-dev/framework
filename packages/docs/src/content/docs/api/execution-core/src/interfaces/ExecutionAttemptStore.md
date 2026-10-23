---
editUrl: false
next: false
prev: false
title: "ExecutionAttemptStore"
---

Optional store capability for atomically fencing mutations to one execution attempt.
Lifecycle transitions, including start, compare the status and attempt number read by the manager.
Return null if either differs, even when the status has returned to its earlier value.

## Methods

### appendLogIfStatusAndAttempt()

> **appendLogIfStatusAndAttempt**(`id`, `expectedStatus`, `expectedAttempt`, `entry`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

#### Parameters

##### id

`string`

##### expectedStatus

[`ExecutionStatus`](/api/execution-core/src/type-aliases/executionstatus/)

##### expectedAttempt

`number`

##### entry

[`ExecutionLogEntry`](/api/execution-core/src/interfaces/executionlogentry/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

---

### mergeCheckpointIfStatusAndAttempt()

> **mergeCheckpointIfStatusAndAttempt**(`id`, `expectedStatus`, `expectedAttempt`, `key`, `value`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

#### Parameters

##### id

`string`

##### expectedStatus

[`ExecutionStatus`](/api/execution-core/src/type-aliases/executionstatus/)

##### expectedAttempt

`number`

##### key

`string`

##### value

`unknown`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

---

### updateIfStatusAndAttempt()

> **updateIfStatusAndAttempt**(`id`, `expectedStatus`, `expectedAttempt`, `data`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

#### Parameters

##### id

`string`

##### expectedStatus

[`ExecutionStatus`](/api/execution-core/src/type-aliases/executionstatus/)

##### expectedAttempt

`number`

##### data

`Partial`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>
