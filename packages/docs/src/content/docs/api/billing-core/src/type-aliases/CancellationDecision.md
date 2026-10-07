---
editUrl: false
next: false
prev: false
title: "CancellationDecision"
---

> **CancellationDecision** = `object`

Durable cancellation choices, policy, source validation, and command receipts.

## Properties

### choiceId?

> `readonly` `optional` **choiceId?**: `string`

---

### decisionId

> `readonly` **decisionId**: `string`

---

### kind

> `readonly` **kind**: `"continue_cancel"` \| `"accept_registered_offer"` \| `"keep_subscription"`

---

### reason?

> `readonly` `optional` **reason?**: `string`
