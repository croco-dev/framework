---
editUrl: false
next: false
prev: false
title: "ExecutionStore"
---

ExecutionStore defines the storage abstraction for execution records.

Implementations (e.g., DrizzleExecutionStore) handle persistence
while ExecutionManager uses this abstract class for CRUD operations.

## Extended by

- [`DrizzleExecutionStore`](/api/execution-drizzle/src/classes/drizzleexecutionstore/)

## Constructors

### Constructor

> **new ExecutionStore**(): `ExecutionStore`

#### Returns

`ExecutionStore`

## Methods

### create()

> `abstract` **create**(`params`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Create a new execution record.

If idempotencyKey is provided and an existing execution with the same key exists,
implementations should return the existing execution instead of creating a new one.

#### Parameters

##### params

[`CreateExecutionRecordParams`](/api/execution-core/src/interfaces/createexecutionrecordparams/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if creation fails (excluding idempotency conflicts)

---

### delete()

> `abstract` **delete**(`id`): `Promise`\<`void`\>

Delete an execution record.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

#### Throws

Error if execution not found or deletion fails

---

### findById()

> `abstract` **findById**(`id`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

Find an execution by its ID.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

Execution or null if not found

---

### findByIdempotencyKey()

> `abstract` **findByIdempotencyKey**(`key`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

Find an execution by idempotency key.

Used for idempotency check during creation.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

Execution or null if not found

---

### list()

> `abstract` **list**(`options?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)[]\>

List executions with optional filtering.

#### Parameters

##### options?

[`ListExecutionsOptions`](/api/execution-core/src/interfaces/listexecutionsoptions/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)[]\>

Array of executions matching the criteria

---

### listRunning()

> `abstract` **listRunning**(`options`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)[]\>

List running executions in stable ID order using keyset pagination.

#### Parameters

##### options

[`ListRunningExecutionsOptions`](/api/execution-core/src/interfaces/listrunningexecutionsoptions/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)[]\>

---

### mergeCheckpoint()

> `abstract` **mergeCheckpoint**(`id`, `key`, `value`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Merge one checkpoint key atomically inside the persistence operation.

Writes to different keys must not overwrite one another. Concurrent writes to the same key
have no invocation-order or Promise-order guarantee: the store serializes the mutations and
the mutation applied last wins. Callers that require deterministic same-key ordering or
conflict detection must use a separate compare-and-set contract.

#### Parameters

##### id

`string`

##### key

`string`

##### value

`unknown`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

ExecutionProblem if execution is not found or the merge fails

---

### update()

> `abstract` **update**(`id`, `data`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Update an execution record.

Only updates fields provided in the data parameter.
Should preserve all existing fields not specified in data.
Optional fields provided as undefined should be cleared.

#### Parameters

##### id

`string`

##### data

`Partial`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Updated execution

#### Throws

Error if execution not found or update fails

---

### updateIfStatus()

> `abstract` **updateIfStatus**(`id`, `expectedStatus`, `data`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

Update an execution only when its persisted status still matches the expected status.

This is the required atomic boundary for lifecycle transitions that may race across workers.

#### Parameters

##### id

`string`

##### expectedStatus

[`ExecutionStatus`](/api/execution-core/src/type-aliases/executionstatus/)

##### data

`Partial`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

Updated execution, or null when another actor changed the status first
