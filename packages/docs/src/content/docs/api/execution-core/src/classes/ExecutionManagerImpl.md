---
editUrl: false
next: false
prev: false
title: "ExecutionManagerImpl"
---

ExecutionManagerImpl provides lifecycle management for executions.

Features:

- State transition validation
- Idempotency check via ExecutionStore
- Timeout handling
- Progress tracking with auto-calculation
- Checkpoint management for batch resume
- Automatic retry transition on failure

## Implements

- [`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/)
- [`ExecutionInspectionManager`](/api/execution-core/src/interfaces/executioninspectionmanager/)
- [`ExecutionReplayManager`](/api/execution-core/src/interfaces/executionreplaymanager/)
- [`ExecutionContinuationManager`](/api/execution-core/src/interfaces/executioncontinuationmanager/)

## Constructors

### Constructor

> **new ExecutionManagerImpl**(`store`, `options?`): `ExecutionManagerImpl`

#### Parameters

##### store

[`ExecutionStore`](/api/execution-core/src/classes/executionstore/)

##### options?

[`ExecutionManagerOptions`](/api/execution-core/src/interfaces/executionmanageroptions/) = `{}`

#### Returns

`ExecutionManagerImpl`

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

#### Implementation of

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/).[`cancel`](/api/execution-core/src/interfaces/executionmanager/#cancel)

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

#### Implementation of

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/).[`checkpoint`](/api/execution-core/src/interfaces/executionmanager/#checkpoint)

---

### claimContinuation()

> **claimContinuation**(`id`, `input`): `Promise`\<[`ClaimExecutionContinuationResult`](/api/execution-core/src/type-aliases/claimexecutioncontinuationresult/)\>

#### Parameters

##### id

`string`

##### input

[`ClaimExecutionContinuationInput`](/api/execution-core/src/interfaces/claimexecutioncontinuationinput/)

#### Returns

`Promise`\<[`ClaimExecutionContinuationResult`](/api/execution-core/src/type-aliases/claimexecutioncontinuationresult/)\>

#### Implementation of

[`ExecutionContinuationManager`](/api/execution-core/src/interfaces/executioncontinuationmanager/).[`claimContinuation`](/api/execution-core/src/interfaces/executioncontinuationmanager/#claimcontinuation)

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

#### Implementation of

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/).[`complete`](/api/execution-core/src/interfaces/executionmanager/#complete)

---

### completeContinuation()

> **completeContinuation**(`id`, `claim`, `result?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### id

`string`

##### claim

[`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/)

##### result?

`unknown`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionContinuationManager`](/api/execution-core/src/interfaces/executioncontinuationmanager/).[`completeContinuation`](/api/execution-core/src/interfaces/executioncontinuationmanager/#completecontinuation)

---

### confirmContinuationPublication()

> **confirmContinuationPublication**(`id`, `claim`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### id

`string`

##### claim

[`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionContinuationManager`](/api/execution-core/src/interfaces/executioncontinuationmanager/).[`confirmContinuationPublication`](/api/execution-core/src/interfaces/executioncontinuationmanager/#confirmcontinuationpublication)

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

#### Implementation of

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/).[`create`](/api/execution-core/src/interfaces/executionmanager/#create)

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

#### Implementation of

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/).[`fail`](/api/execution-core/src/interfaces/executionmanager/#fail)

---

### failContinuation()

> **failContinuation**(`id`, `claim`, `error`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### id

`string`

##### claim

[`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/)

##### error

[`ExecutionError`](/api/execution-core/src/interfaces/executionerror/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionContinuationManager`](/api/execution-core/src/interfaces/executioncontinuationmanager/).[`failContinuation`](/api/execution-core/src/interfaces/executioncontinuationmanager/#failcontinuation)

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

#### Implementation of

[`ExecutionInspectionManager`](/api/execution-core/src/interfaces/executioninspectionmanager/).[`get`](/api/execution-core/src/interfaces/executioninspectionmanager/#get)

---

### list()

> **list**(`options?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)[]\>

List executions for inspection and operations views.

#### Parameters

##### options?

[`ListExecutionsOptions`](/api/execution-core/src/interfaces/listexecutionsoptions/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)[]\>

#### Implementation of

[`ExecutionInspectionManager`](/api/execution-core/src/interfaces/executioninspectionmanager/).[`list`](/api/execution-core/src/interfaces/executioninspectionmanager/#list)

---

### reconcileTimedOut()

> **reconcileTimedOut**(`options?`): `Promise`\<[`ReconcileTimedOutResult`](/api/execution-core/src/interfaces/reconciletimedoutresult/)\>

Reconcile persisted running executions whose configured deadline has elapsed.

#### Parameters

##### options?

[`ReconcileTimedOutOptions`](/api/execution-core/src/interfaces/reconciletimedoutoptions/) = `{}`

#### Returns

`Promise`\<[`ReconcileTimedOutResult`](/api/execution-core/src/interfaces/reconciletimedoutresult/)\>

#### Implementation of

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/).[`reconcileTimedOut`](/api/execution-core/src/interfaces/executionmanager/#reconciletimedout)

---

### recordLog()

> **recordLog**(`id`, `params`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Append a structured log entry to an execution.

#### Parameters

##### id

`string`

##### params

[`AddExecutionLogParams`](/api/execution-core/src/interfaces/addexecutionlogparams/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found

#### Implementation of

[`ExecutionInspectionManager`](/api/execution-core/src/interfaces/executioninspectionmanager/).[`recordLog`](/api/execution-core/src/interfaces/executioninspectionmanager/#recordlog)

---

### renewContinuationClaim()

> **renewContinuationClaim**(`id`, `claim`, `input`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### id

`string`

##### claim

[`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/)

##### input

[`RenewExecutionContinuationInput`](/api/execution-core/src/interfaces/renewexecutioncontinuationinput/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionContinuationManager`](/api/execution-core/src/interfaces/executioncontinuationmanager/).[`renewContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationmanager/#renewcontinuationclaim)

---

### replay()

> **replay**(`id`, `params?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Create a new pending execution linked to a failed or timed-out source execution.

Replay intentionally does not copy idempotencyKey, so operators can replay a failed
execution without returning the original record through deduplication.

#### Parameters

##### id

`string`

##### params?

[`ReplayExecutionParams`](/api/execution-core/src/interfaces/replayexecutionparams/) = `{}`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found or source execution is not replayable

#### Implementation of

[`ExecutionReplayManager`](/api/execution-core/src/interfaces/executionreplaymanager/).[`replay`](/api/execution-core/src/interfaces/executionreplaymanager/#replay)

---

### retry()

> **retry**(`id`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Retry a failed or timed-out execution.

Preserves the consumed attempt count and transitions to 'retrying' status.
The subsequent start() call transitions to 'running' and increments attempts exactly once.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found or maxAttempts exhausted

#### Implementation of

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/).[`retry`](/api/execution-core/src/interfaces/executionmanager/#retry)

---

### stageContinuation()

> **stageContinuation**(`id`, `claim`, `input`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### id

`string`

##### claim

[`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/)

##### input

[`StageExecutionContinuationInput`](/api/execution-core/src/interfaces/stageexecutioncontinuationinput/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionContinuationManager`](/api/execution-core/src/interfaces/executioncontinuationmanager/).[`stageContinuation`](/api/execution-core/src/interfaces/executioncontinuationmanager/#stagecontinuation)

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

#### Implementation of

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/).[`start`](/api/execution-core/src/interfaces/executionmanager/#start)

---

### timeout()

> **timeout**(`id`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Mark an execution as timed out.

Transitions status to 'timed_out' and sets completedAt.
Called internally when timeout threshold is exceeded.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found or state transition is invalid

#### Implementation of

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/).[`timeout`](/api/execution-core/src/interfaces/executionmanager/#timeout)

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

#### Implementation of

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/).[`updateProgress`](/api/execution-core/src/interfaces/executionmanager/#updateprogress)
