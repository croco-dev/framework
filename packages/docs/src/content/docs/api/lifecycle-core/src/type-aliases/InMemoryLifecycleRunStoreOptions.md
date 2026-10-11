---
editUrl: false
next: false
prev: false
title: "InMemoryLifecycleRunStoreOptions"
---

> **InMemoryLifecycleRunStoreOptions** = `object`

## Properties

### now?

> `readonly` `optional` **now?**: () => `Date`

#### Returns

`Date`

---

### receiptTtlMs?

> `readonly` `optional` **receiptTtlMs?**: `number`

How long finalized receipts are retained for redelivery dedupe. Must be
aligned with the supported replay horizon: redelivery after expiry is
treated as a new receipt, not as a duplicate.
