---
editUrl: false
next: false
prev: false
title: "TaskExecutionOptions"
---

> **TaskExecutionOptions** = `object`

Runtime options for a single task execution.

## Properties

### idempotencyKey?

> `optional` **idempotencyKey?**: `string`

Optional execution-level idempotency key for deduplicating this task run.

---

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

Optional execution metadata for inspection and operations views.

---

### parentId?

> `optional` **parentId?**: `string`

Optional parent execution ID when this task is part of a workflow or batch.
