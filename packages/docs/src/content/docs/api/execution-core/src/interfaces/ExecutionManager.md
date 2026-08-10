---
editUrl: false
next: false
prev: false
title: "ExecutionManager"
---

ExecutionManager defines the lifecycle management interface for executions.

Handles state transitions, idempotency, timeout tracking, progress updates,
and checkpoint management for batch resume functionality.

## Methods

### cancel()

> **cancel**(`id`, `reason?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Cancel an execution (transition to 'cancelled').

Sets completedAt timestamp and status to 'cancelled'.

#### Parameters

##### id

`string`

##### reason?

`string`

Optional cancellation reason (stored in metadata)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found or state transition is invalid

---

### checkpoint()

> **checkpoint**(`id`, `key`, `value`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Set a checkpoint for batch resume functionality.

Stores key-value pairs in the checkpoints map for later resume.

#### Parameters

##### id

`string`

##### key

`string`

Checkpoint key

##### value

`unknown`

Checkpoint value

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found

---

### complete()

> **complete**(`id`, `result?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Complete an execution (transition to 'completed').

Sets the result, completedAt timestamp, and status to 'completed'.

#### Parameters

##### id

`string`

##### result?

`unknown`

Optional result data

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found or state transition is invalid

---

### create()

> **create**(`params`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Create a new execution.

If idempotencyKey is provided and an existing execution with the same key exists,
returns the existing execution instead of creating a new one.

The execution is created in 'pending' status.

#### Parameters

##### params

[`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Created or existing execution

---

### fail()

> **fail**(`id`, `error`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Fail an execution (transition to 'failed').

Sets the error details and completedAt timestamp.
If maxAttempts not exhausted, automatically transitions to 'retrying'.

#### Parameters

##### id

`string`

##### error

[`ExecutionError`](/api/execution-core/src/interfaces/executionerror/)

Error details

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found or state transition is invalid

---

### get()

> **get**(`id`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Get a single execution by ID.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found

---

### reconcileTimedOut()

> **reconcileTimedOut**(`options?`): `Promise`\<[`ReconcileTimedOutResult`](/api/execution-core/src/interfaces/reconciletimedoutresult/)\>

Reconcile persisted running executions whose configured deadline has elapsed.

#### Parameters

##### options?

[`ReconcileTimedOutOptions`](/api/execution-core/src/interfaces/reconciletimedoutoptions/)

#### Returns

`Promise`\<[`ReconcileTimedOutResult`](/api/execution-core/src/interfaces/reconciletimedoutresult/)\>

---

### retry()

> **retry**(`id`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Retry a failed or safely resolved timed-out execution.

Preserves the consumed attempt count and transitions to 'retrying' status.
The subsequent start() call transitions to 'running' and increments attempts exactly once.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found, maxAttempts exhausted, or timeout outcome remains indeterminate

---

### start()

> **start**(`id`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Start an execution (transition to 'running').

Sets startedAt timestamp and increments attempts counter.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found or state transition is invalid

---

### timeout()

> **timeout**(`id`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Mark an execution as timed out.

Transitions status to an indeterminate 'timed_out' outcome and sets completedAt.
Called internally when timeout threshold is exceeded.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found or state transition is invalid

---

### updateProgress()

> **updateProgress**(`id`, `progress`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Update progress information for an execution.

Automatically calculates percent if not provided.

#### Parameters

##### id

`string`

##### progress

[`ProgressInfo`](/api/execution-core/src/interfaces/progressinfo/)

Progress information

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found
