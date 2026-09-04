---
editUrl: false
next: false
prev: false
title: "DeadLetterReplayFailure"
---

> **DeadLetterReplayFailure** = `object`

A dead-letter entry that could not be replayed successfully.

## Properties

### error

> **error**: `Error`

Replay or handler failure returned to the caller.

---

### eventId

> **eventId**: `string`

Stable identity of the original event.

---

### eventName

> **eventName**: `string`

Registered event name used to resolve the failed handler.

---

### handlerId?

> `optional` **handlerId?**: `string`

Stable handler identity recorded when the entry was dead-lettered.

---

### item

> **item**: [`DeadLetterItem`](/api/events-core/src/type-aliases/deadletteritem/)

Exact failed work, including updated retry metadata, for recovery. Contains event payload.

---

### requeued

> **requeued**: `boolean`

Whether the failed item was successfully returned to storage.

---

### storageError?

> `optional` **storageError?**: `Error`

Storage failure, separate from the original execution failure.
