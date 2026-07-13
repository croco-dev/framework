---
editUrl: false
next: false
prev: false
title: "TaskExecutionContext"
---

> **TaskExecutionContext** = `object`

Runtime context provided as the optional second argument to task handlers.

## Properties

### attempt

> **attempt**: `number`

Persisted attempt number returned by ExecutionManager.start().

***

### executionId

> **executionId**: `string`

Persisted execution identifier used for inspection and retry.

***

### signal

> **signal**: `AbortSignal`

Cooperative cancellation signal aborted when the execution deadline expires.
