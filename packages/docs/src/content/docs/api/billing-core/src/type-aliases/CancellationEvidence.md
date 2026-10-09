---
editUrl: false
next: false
prev: false
title: "CancellationEvidence"
---

> **CancellationEvidence** = `object`

Durable cancellation choices, policy, source validation, and command receipts.

## Properties

### at

> `readonly` **at**: `string`

---

### commandReceipt?

> `readonly` `optional` **commandReceipt?**: [`CancellationCommandReceipt`](/api/billing-core/src/type-aliases/cancellationcommandreceipt/)

---

### decisionId?

> `readonly` `optional` **decisionId?**: `string`

---

### kind

> `readonly` **kind**: `"intent"` \| `"displayed"` \| `"decision"` \| `"command"` \| `"provider"`
