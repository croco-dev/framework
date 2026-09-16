---
editUrl: false
next: false
prev: false
title: "QStashTriggerExecutionContext"
---

> **QStashTriggerExecutionContext** = `object`

Runtime context passed to a QStash cron target after its webhook payload.

## Properties

### attempt

> `readonly` **attempt**: `number`

Persisted attempt number returned by ExecutionManager.start().

---

### executionId

> `readonly` **executionId**: `string`

Persisted execution identifier used for inspection and idempotent effects.

---

### signal

> `readonly` **signal**: `AbortSignal`

Cooperative cancellation signal aborted when executionTimeout expires.
