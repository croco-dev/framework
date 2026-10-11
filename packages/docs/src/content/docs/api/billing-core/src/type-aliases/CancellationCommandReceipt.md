---
editUrl: false
next: false
prev: false
title: "CancellationCommandReceipt"
---

> **CancellationCommandReceipt** = `object`

Durable cancellation choices, policy, source validation, and command receipts.

## Properties

### commandId

> `readonly` **commandId**: `string`

---

### effect

> `readonly` **effect**: `"none"` \| `"cancellation_scheduled"` \| `"ended"` \| `"resumed"` \| `"plan_changed"`

---

### providerOutcome

> `readonly` **providerOutcome**: `"pending"` \| `"confirmed"` \| `"failed"` \| `"indeterminate"`

---

### refundOutcome

> `readonly` **refundOutcome**: `"not_requested"` \| `"pending"` \| `"confirmed"` \| `"failed"` \| `"indeterminate"`
