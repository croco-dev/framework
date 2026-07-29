---
editUrl: false
next: false
prev: false
title: "BillingLifecycleCommand"
---

> **BillingLifecycleCommand** = `object`

Durable evidence for one logical subscription lifecycle mutation.

`pending_provider` keeps the local subscription authoritative.
`pending_local` means the provider accepted the mutation and entitlement reads project the
command's target state until local reconciliation completes.

## Properties

### createdAt

> `readonly` **createdAt**: `Date`

---

### eventDeliveryLeaseUntil?

> `readonly` `optional` **eventDeliveryLeaseUntil?**: `Date`

---

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

---

### kind

> `readonly` **kind**: [`BillingLifecycleCommandKind`](/api/billing-core/src/type-aliases/billinglifecyclecommandkind/)

---

### lastFailure?

> `readonly` `optional` **lastFailure?**: [`BillingLifecycleCommandFailure`](/api/billing-core/src/type-aliases/billinglifecyclecommandfailure/)

---

### localResult?

> `readonly` `optional` **localResult?**: [`BillingLifecycleLocalResult`](/api/billing-core/src/type-aliases/billinglifecyclelocalresult/)

---

### revision

> `readonly` **revision**: `number`

---

### state

> `readonly` **state**: [`BillingLifecycleCommandState`](/api/billing-core/src/type-aliases/billinglifecyclecommandstate/)

---

### subscription

> `readonly` **subscription**: [`Subscription`](/api/billing-core/src/type-aliases/subscription/)

---

### tenantId

> `readonly` **tenantId**: `string`

---

### updatedAt

> `readonly` **updatedAt**: `Date`
