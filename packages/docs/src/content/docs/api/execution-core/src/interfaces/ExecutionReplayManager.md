---
editUrl: false
next: false
prev: false
title: "ExecutionReplayManager"
---

Optional replay capabilities for execution managers.

## Methods

### replay()

> **replay**(`id`, `params?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Create a new pending execution linked to a failed or timed-out source execution.

Replay intentionally does not copy idempotencyKey, so operators can replay a failed
execution without returning the original record through deduplication.

#### Parameters

##### id

`string`

##### params?

[`ReplayExecutionParams`](/api/execution-core/src/interfaces/replayexecutionparams/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found or source execution is not replayable
