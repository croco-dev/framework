---
editUrl: false
next: false
prev: false
title: "AddExecutionLogParams"
---

Parameters for recording an execution log entry.

## Properties

### data?

> `optional` **data?**: `Record`\<`string`, `unknown`\>

Optional structured log data

---

### level?

> `optional` **level?**: [`ExecutionLogLevel`](/api/execution-core/src/type-aliases/executionloglevel/)

Severity level (default: info)

---

### message

> **message**: `string`

Human-readable log message

---

### timestamp?

> `optional` **timestamp?**: `string` \| `Date`

Optional timestamp override for deterministic tests or imported logs
