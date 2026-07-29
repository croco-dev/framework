---
editUrl: false
next: false
prev: false
title: "CreateExecutionParams"
---

Parameters for creating a new execution.

## Properties

### idempotencyKey?

> `optional` **idempotencyKey?**: `string`

Optional idempotency key for deduplication

---

### legacyIdempotencyKeys?

> `optional` **legacyIdempotencyKeys?**: readonly `string`[]

Optional legacy keys checked only for a matching execution request.

This supports bounded idempotency-key migrations without allowing a legacy collision
from another execution type to block the new key. A matching execution type with a
different durably persisted payload is an explicit idempotency conflict.

Legacy and replacement writers must not run concurrently because lookup and creation
across two different keys cannot be made atomic by the ExecutionStore contract.

---

### logs?

> `optional` **logs?**: [`ExecutionLogEntry`](/api/execution-core/src/interfaces/executionlogentry/)[]

Initial log entries

---

### maxAttempts?

> `optional` **maxAttempts?**: `number`

Maximum retry attempts (default: 1)

---

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

Optional metadata

---

### parentId?

> `optional` **parentId?**: `string`

Optional parent execution ID for nested executions

---

### payload?

> `optional` **payload?**: `unknown`

Optional payload data

---

### replayOf?

> `optional` **replayOf?**: `string`

Optional original execution ID when this execution is a replay

---

### scheduledFor?

> `optional` **scheduledFor?**: `Date`

Optional scheduled start time

---

### timeout?

> `optional` **timeout?**: `number`

Timeout in milliseconds (default: no timeout)

---

### type

> **type**: `string`

Execution type: 'task' | 'batch' | 'workflow'
