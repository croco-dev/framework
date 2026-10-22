---
editUrl: false
next: false
prev: false
title: "ReplayExecutionParams"
---

Parameters for replaying a failed execution.

## Properties

### idempotencyKey?

> `optional` **idempotencyKey?**: `string`

Optional durable replay key, scoped to the source execution. Concurrent matching requests
reuse one replay; different payload, reason or metadata with the same key conflicts.
Omitting the key preserves independent replay creation.

---

### legacyReplayId?

> `optional` **legacyReplayId?**: `string`

Optional pre-key replay receipt to reuse during migration. Requires idempotencyKey; the manager
validates its source, payload and effective replay metadata without changing the receipt.
A conflicting record is never overwritten.

---

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

Optional metadata merged before system replay metadata

---

### payload?

> `optional` **payload?**: `unknown`

Optional payload override. Defaults to the original execution payload.

---

### reason?

> `optional` **reason?**: `string`

Optional replay reason stored in metadata and initial log entry
