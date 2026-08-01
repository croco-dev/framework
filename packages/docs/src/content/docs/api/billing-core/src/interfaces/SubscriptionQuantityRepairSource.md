---
editUrl: false
next: false
prev: false
title: "SubscriptionQuantityRepairSource"
---

## Methods

### listCandidates()

> **listCandidates**(`limit`): `Promise`\<readonly [`ReconcileSubscriptionQuantityInput`](/api/billing-core/src/type-aliases/reconcilesubscriptionquantityinput/)[]\>

Returns the next bounded page from the durable subscription inventory.

Implementations own the scan cursor so repeated calls eventually cover in-sync subscriptions
as well as subscriptions whose first membership event was missed.

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<readonly [`ReconcileSubscriptionQuantityInput`](/api/billing-core/src/type-aliases/reconcilesubscriptionquantityinput/)[]\>
