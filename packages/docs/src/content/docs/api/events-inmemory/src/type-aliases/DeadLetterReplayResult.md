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

Number of entries atomically claimed from the queue.

---

### failed

> **failed**: `number`

Number of entries returned to the queue after replay failure.

---

### failures

> **failures**: [`DeadLetterReplayFailure`](/api/events-inmemory/src/type-aliases/deadletterreplayfailure/)[]

Per-entry failures for entries returned to the queue.

---

### succeeded

> **succeeded**: `number`

Number of entries consumed after successful handler execution.
