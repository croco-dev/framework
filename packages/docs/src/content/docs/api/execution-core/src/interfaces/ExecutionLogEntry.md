---
editUrl: false
next: false
prev: false
title: "ExecutionLogEntry"
---

Append-only execution log entry for inspectable workflow/task history.

## Properties

### data?

> `optional` **data?**: `Record`\<`string`, `unknown`\>

Optional structured log data

---

### level

> **level**: [`ExecutionLogLevel`](/api/execution-core/src/type-aliases/executionloglevel/)

Severity level

---

### message

> **message**: `string`

Human-readable log message

---

### timestamp

> **timestamp**: `string`

ISO timestamp for when this log entry was recorded
