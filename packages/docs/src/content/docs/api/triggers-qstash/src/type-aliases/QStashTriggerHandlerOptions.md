---
editUrl: false
next: false
prev: false
title: "QStashTriggerHandlerOptions"
---

> **QStashTriggerHandlerOptions** = `object`

Configuration options for QStashTriggerHandler.

## Properties

### executionManager

> `readonly` **executionManager**: `ExecutionManager`

Execution manager for dispatching executions.

---

### receiver

> `readonly` **receiver**: `Receiver`

QStash receiver instance for verifying webhook signatures.

---

### serviceResolver?

> `readonly` `optional` **serviceResolver?**: `ServiceResolver`

Optional service resolver for getting target instances.
If not provided, uses the framework Container with constructor fallback.
