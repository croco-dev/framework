---
editUrl: false
next: false
prev: false
title: "Execution"
---

Execution entity representing a single execution record.

## Properties

### attempts

> **attempts**: `number`

Current attempt count

***

### checkpoints?

> `optional` **checkpoints?**: `Record`\<`string`, `unknown`\>

Checkpoints for batch resume (key-value pairs)

***

### completedAt?

> `optional` **completedAt?**: `Date`

Execution completion timestamp

***

### createdAt

> **createdAt**: `Date`

Creation timestamp

***

### error?

> `optional` **error?**: [`ExecutionError`](/api/execution-core/src/interfaces/executionerror/)

Error details (set on failure)

***

### id

> **id**: `string`

Unique execution ID

***

### idempotencyKey?

> `optional` **idempotencyKey?**: `string`

Optional idempotency key for deduplication

***

### logs?

> `optional` **logs?**: [`ExecutionLogEntry`](/api/execution-core/src/interfaces/executionlogentry/)[]

Append-only inspection log

***

### maxAttempts

> **maxAttempts**: `number`

Maximum allowed attempts

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

Optional metadata

***

### parentId?

> `optional` **parentId?**: `string`

Optional parent execution ID

***

### payload?

> `optional` **payload?**: `unknown`

Optional payload data

***

### progress?

> `optional` **progress?**: [`ProgressInfo`](/api/execution-core/src/interfaces/progressinfo/)

Progress information

***

### replayOf?

> `optional` **replayOf?**: `string`

Original execution ID when this execution was created by replay

***

### result?

> `optional` **result?**: `unknown`

Execution result (set on completion)

***

### scheduledFor?

> `optional` **scheduledFor?**: `Date`

Optional scheduled start time

***

### startedAt?

> `optional` **startedAt?**: `Date`

Execution start timestamp

***

### status

> **status**: [`ExecutionStatus`](/api/execution-core/src/type-aliases/executionstatus/)

Current execution status

***

### timeout?

> `optional` **timeout?**: `number`

Timeout in milliseconds

***

### type

> **type**: `string`

Execution type: 'task' | 'batch' | 'workflow'
