---
editUrl: false
next: false
prev: false
title: "TaskOptions"
---

> **TaskOptions** = `object`

Task options for configuring task behavior.

## Properties

### idempotencyKey?

> `optional` **idempotencyKey?**: `string`

Optional idempotency key for deduplication.

---

### maxAttempts?

> `optional` **maxAttempts?**: `number`

Maximum retry attempts (default: 1).

---

### name?

> `optional` **name?**: `string`

Optional task name. If not provided, defaults to 'ClassName.methodName'.

---

### timeout?

> `optional` **timeout?**: `number`

Timeout in milliseconds (default: no timeout).

---

### timeoutRetry?

> `optional` **timeoutRetry?**: [`TaskTimeoutRetryPolicy`](/api/tasks-core/src/type-aliases/tasktimeoutretrypolicy/)

Explicit contract permitting retry after timeout.

The default waits for the abandoned handler to settle before retry becomes safe.
Idempotent handlers tolerate duplicate effects. Fenced handlers reject stale attemptToken mutations.
