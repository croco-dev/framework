---
editUrl: false
next: false
prev: false
title: "CancellationSession"
---

> **CancellationSession** = [`CancellationIdentity`](/api/billing-core/src/type-aliases/cancellationidentity/) & `object`

Durable cancellation choices, policy, source validation, and command receipts.

## Type Declaration

### choices

> `readonly` **choices**: readonly [`CancellationChoice`](/api/billing-core/src/type-aliases/cancellationchoice/)[]

### commandReceipt?

> `readonly` `optional` **commandReceipt?**: [`CancellationCommandReceipt`](/api/billing-core/src/type-aliases/cancellationcommandreceipt/)

### createdAt

> `readonly` **createdAt**: `string`

### decision?

> `readonly` `optional` **decision?**: [`CancellationDecision`](/api/billing-core/src/type-aliases/cancellationdecision/)

### displayedAt?

> `readonly` `optional` **displayedAt?**: `string`

### evidence

> `readonly` **evidence**: readonly [`CancellationEvidence`](/api/billing-core/src/type-aliases/cancellationevidence/)[]

### id

> `readonly` **id**: `string`

### keepAvailable

> `readonly` **keepAvailable**: `boolean`

### policyVersion

> `readonly` **policyVersion**: `number`

### quoteRef

> `readonly` **quoteRef**: `string`

### revision

> `readonly` **revision**: `number`

### snapshot

> `readonly` **snapshot**: [`CancellationSnapshot`](/api/billing-core/src/type-aliases/cancellationsnapshot/)

### state

> `readonly` **state**: `"open"` \| `"decided"`

### subscriptionRevision

> `readonly` **subscriptionRevision**: `string`
