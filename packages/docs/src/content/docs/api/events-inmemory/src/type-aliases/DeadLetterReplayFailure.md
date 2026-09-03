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
