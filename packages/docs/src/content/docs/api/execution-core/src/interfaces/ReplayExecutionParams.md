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

### legacyReplayIds?

> `optional` **legacyReplayIds?**: readonly `string`[]

Existing replay receipt candidates for recovering a pre-key audit identity. A non-empty list
requires idempotencyKey and an atomic replay-identity store. An existing key wins; otherwise
exactly one distinct receipt must match source, payload and effective metadata.
Only key/fingerprint are assigned; audit, payload and outcome remain unchanged.

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
