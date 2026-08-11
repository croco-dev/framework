---
editUrl: false
next: false
prev: false
title: "ExecutionError"
---

Error details for failed executions.

## Properties

### code?

> `optional` **code?**: `string`

Optional error code for categorization

---

### indeterminate?

> `optional` **indeterminate?**: `boolean`

Whether the abandoned attempt may still commit side effects. The state clears when the handler
settles, an idempotent or fenced retry contract is confirmed, or an operator records recovery.

---

### message

> **message**: `string`

Error message

---

### retryable

> **retryable**: `boolean`

Whether this error is retryable

---

### stack?

> `optional` **stack?**: `string`

Stack trace for debugging
