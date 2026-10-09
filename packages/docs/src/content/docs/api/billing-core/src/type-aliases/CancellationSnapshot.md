---
editUrl: false
next: false
prev: false
title: "CancellationSnapshot"
---

> **CancellationSnapshot** = [`CancellationIdentity`](/api/billing-core/src/type-aliases/cancellationidentity/) & `object`

Durable cancellation choices, policy, source validation, and command receipts.

## Type Declaration

### billingPeriod

> `readonly` **billingPeriod**: `"initial"` \| `"renewal"`

### quote

> `readonly` **quote**: [`CancellationQuote`](/api/billing-core/src/type-aliases/cancellationquote/)

### revision

> `readonly` **revision**: `string`

### status

> `readonly` **status**: `"active"` \| `"cancellation_scheduled"` \| `"ended"`

### subscriptionStartedAt

> `readonly` **subscriptionStartedAt**: `string`
