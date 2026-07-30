---
editUrl: false
next: false
prev: false
title: "createSubscriptionQuantityReconciliationId"
---

> **createSubscriptionQuantityReconciliationId**(`input`): `string`

Creates a deterministic reconciliation identity from tenant, subscription, plan, quantity, and source version.

## Parameters

### input

#### desiredQuantity

`number`

#### externalSubscriptionId

`string`

#### planVersionRef

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### sourceVersion

`number`

#### tenantId

`string`

## Returns

`string`
