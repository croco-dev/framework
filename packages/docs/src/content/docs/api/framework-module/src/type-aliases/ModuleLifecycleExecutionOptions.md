---
editUrl: false
next: false
prev: false
title: "ModuleLifecycleExecutionOptions"
---

> **ModuleLifecycleExecutionOptions** = `object`

## Properties

### deadline?

> `readonly` `optional` **deadline?**: `number`

Absolute Unix timestamp in milliseconds shared by every hook in this lifecycle operation.

---

### signal?

> `readonly` `optional` **signal?**: `AbortSignal`

Parent cancellation signal propagated to every hook in this lifecycle operation.
