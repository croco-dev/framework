---
editUrl: false
next: false
prev: false
title: "DeadLetterReplayResult"
---

> **DeadLetterReplayResult** = `object`

Summary returned after a bounded dead-letter replay batch.

## Properties

### attempted

> **attempted**: `number`

Number of entries atomically removed from the queue for this batch.

---

### failed

> **failed**: `number`

Number of unsuccessful entries; inspect each failure's requeued flag for storage state.

---

### failures

> **failures**: [`DeadLetterReplayFailure`](/api/events-inmemory/src/type-aliases/deadletterreplayfailure/)[]

Per-entry failures, including recoverable items when storage rejected a write.

---

### succeeded

> **succeeded**: `number`

Number of entries consumed after successful handler execution.
