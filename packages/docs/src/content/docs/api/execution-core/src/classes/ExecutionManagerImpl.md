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
- [`ExecutionAttemptManager`](/api/execution-core/src/interfaces/executionattemptmanager/)
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

### checkpointAttempt()

> **checkpointAttempt**(`token`, `key`, `value`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### key

`string`

##### value

`unknown`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionAttemptManager`](/api/execution-core/src/interfaces/executionattemptmanager/).[`checkpointAttempt`](/api/execution-core/src/interfaces/executionattemptmanager/#checkpointattempt)

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

### completeAttempt()

> **completeAttempt**(`token`, `result?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### result?

`unknown`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionAttemptManager`](/api/execution-core/src/interfaces/executionattemptmanager/).[`completeAttempt`](/api/execution-core/src/interfaces/executionattemptmanager/#completeattempt)

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

### failAttempt()

> **failAttempt**(`token`, `error`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### error

[`ExecutionError`](/api/execution-core/src/interfaces/executionerror/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionAttemptManager`](/api/execution-core/src/interfaces/executionattemptmanager/).[`failAttempt`](/api/execution-core/src/interfaces/executionattemptmanager/#failattempt)

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

### getContinuationLeaseDurationMs()

> **getContinuationLeaseDurationMs**(): `number`

Return the lease duration used for continuation claims.

Continuation runtimes use this value to validate that their heartbeat
cadence renews ownership before the lease can expire.

#### Returns

`number`

#### Implementation of

[`ExecutionContinuationManager`](/api/execution-core/src/interfaces/executioncontinuationmanager/).[`getContinuationLeaseDurationMs`](/api/execution-core/src/interfaces/executioncontinuationmanager/#getcontinuationleasedurationms)

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

### recordLogAttempt()

> **recordLogAttempt**(`token`, `params`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### params

[`AddExecutionLogParams`](/api/execution-core/src/interfaces/addexecutionlogparams/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionAttemptManager`](/api/execution-core/src/interfaces/executionattemptmanager/).[`recordLogAttempt`](/api/execution-core/src/interfaces/executionattemptmanager/#recordlogattempt)

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

### resolveIndeterminateTimeout()

> **resolveIndeterminateTimeout**(`token`, `reason`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### reason

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionAttemptManager`](/api/execution-core/src/interfaces/executionattemptmanager/).[`resolveIndeterminateTimeout`](/api/execution-core/src/interfaces/executionattemptmanager/#resolveindeterminatetimeout)

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

#### Implementation of

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/).[`retry`](/api/execution-core/src/interfaces/executionmanager/#retry)

---

### settleTimedOutAttempt()

> **settleTimedOutAttempt**(`token`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionAttemptManager`](/api/execution-core/src/interfaces/executionattemptmanager/).[`settleTimedOutAttempt`](/api/execution-core/src/interfaces/executionattemptmanager/#settletimedoutattempt)

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

### supportsAttemptFencing()

> **supportsAttemptFencing**(): `boolean`

Whether the configured persistence store can enforce atomic attempt fencing.

#### Returns

`boolean`

#### Implementation of

[`ExecutionAttemptManager`](/api/execution-core/src/interfaces/executionattemptmanager/).[`supportsAttemptFencing`](/api/execution-core/src/interfaces/executionattemptmanager/#supportsattemptfencing)

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

#### Implementation of

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/).[`timeout`](/api/execution-core/src/interfaces/executionmanager/#timeout)

---

### timeoutAttempt()

> **timeoutAttempt**(`token`, `options`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### options

###### retryable

`boolean`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionAttemptManager`](/api/execution-core/src/interfaces/executionattemptmanager/).[`timeoutAttempt`](/api/execution-core/src/interfaces/executionattemptmanager/#timeoutattempt)

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

---

### updateProgressAttempt()

> **updateProgressAttempt**(`token`, `progress`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### progress

[`ProgressInfo`](/api/execution-core/src/interfaces/progressinfo/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionAttemptManager`](/api/execution-core/src/interfaces/executionattemptmanager/).[`updateProgressAttempt`](/api/execution-core/src/interfaces/executionattemptmanager/#updateprogressattempt)
