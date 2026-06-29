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

***

### maxAttempts?

> `optional` **maxAttempts?**: `number`

Maximum retry attempts (default: 1).

***

### name?

> `optional` **name?**: `string`

Optional task name. If not provided, defaults to 'ClassName.methodName'.

***

### timeout?

> `optional` **timeout?**: `number`

Timeout in milliseconds (default: no timeout).
