---
editUrl: false
next: false
prev: false
title: "ExecutionCheckpointConcurrencyResult"
---

> **ExecutionCheckpointConcurrencyResult** = `object`

## Properties

### lastAppliedWrite

> `readonly` **lastAppliedWrite**: `number`

Index of the write whose storage mutation was applied last.

Invocation order and Promise settlement order are not storage ordering evidence. Adapter
harnesses must control or observe the actual mutation order before returning this index.
