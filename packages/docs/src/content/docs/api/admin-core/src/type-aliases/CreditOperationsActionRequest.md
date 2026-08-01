---
editUrl: false
next: false
prev: false
title: "CreditOperationsActionRequest"
---

> **CreditOperationsActionRequest** = [`CreditOperationsWriteEvidence`](/api/admin-core/src/type-aliases/creditoperationswriteevidence/) & `object`

## Type Declaration

### accountId

> `readonly` **accountId**: `string`

### action

> `readonly` **action**: [`CreditOperationsActionKind`](/api/admin-core/src/type-aliases/creditoperationsactionkind/)

### input

> `readonly` **input**: `object` & `CreditGrantOrAdjustmentTerms` \| \{ `amount`: `string`; `consumptionTransactionId`: `string`; `kind`: `"refund"`; \} \| \{ `kind`: `"release-reservation"`; `reservationId`: `string`; \} \| `object` & `CreditGrantOrAdjustmentTerms`

### targetId

> `readonly` **targetId**: `string`

### tenantId

> `readonly` **tenantId**: `string`
