---
editUrl: false
next: false
prev: false
title: "LifecycleRunClaim"
---

> **LifecycleRunClaim** = `object`

## Properties

### claimedAt

> `readonly` **claimedAt**: `Date`

---

### cooldownSince?

> `readonly` `optional` **cooldownSince?**: `Date`

---

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

---

### legacyIdempotencyKey?

> `readonly` `optional` **legacyIdempotencyKey?**: `string`

Legacy default key accepted for one release so existing persisted receipts
keep deduping during migration. New claims never issue it.

---

### ruleId

> `readonly` **ruleId**: `string`

---

### runId

> `readonly` **runId**: `string`

---

### sourceFingerprint?

> `readonly` `optional` **sourceFingerprint?**: `string`

Canonical semantic payload fingerprint for conflict checks only. Carries no
identity semantics; two claims with the same key but different fingerprints
are a conflict, not a dedupe hit or a new event.

---

### tenantId

> `readonly` **tenantId**: `string`
