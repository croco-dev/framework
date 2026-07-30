---
editUrl: false
next: false
prev: false
title: "SubscriptionQuantitySnapshot"
---

> **SubscriptionQuantitySnapshot** = `object`

## Properties

### activeMembershipCount

> `readonly` **activeMembershipCount**: `number`

***

### attemptCount

> `readonly` **attemptCount**: `number`

***

### billableMembershipCount

> `readonly` **billableMembershipCount**: `number`

***

### createdAt

> `readonly` **createdAt**: `Date`

***

### desiredQuantity

> `readonly` **desiredQuantity**: `number`

***

### entitlementSeatQuota

> `readonly` **entitlementSeatQuota**: `number`

***

### externalSubscriptionId

> `readonly` **externalSubscriptionId**: `string`

***

### lastAttemptAt?

> `readonly` `optional` **lastAttemptAt?**: `Date`

***

### lastFailure?

> `readonly` `optional` **lastFailure?**: [`SubscriptionQuantityFailureEvidence`](/api/billing-core/src/type-aliases/subscriptionquantityfailureevidence/)

***

### lastSuccessAt?

> `readonly` `optional` **lastSuccessAt?**: `Date`

***

### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

***

### providerAcceptedSourceVersion?

> `readonly` `optional` **providerAcceptedSourceVersion?**: `number`

***

### providerOperationId?

> `readonly` `optional` **providerOperationId?**: `string`

***

### providerQuantity

> `readonly` **providerQuantity**: `number` \| `null`

***

### providerVersion?

> `readonly` `optional` **providerVersion?**: `string`

***

### reason

> `readonly` **reason**: `string`

***

### reconciliationId

> `readonly` **reconciliationId**: `string`

***

### revision

> `readonly` **revision**: `number`

***

### sourceEvidence

> `readonly` **sourceEvidence**: `Readonly`\<`Record`\<`string`, `string` \| `number` \| `boolean`\>\>

***

### sourceVersion

> `readonly` **sourceVersion**: `number`

***

### state

> `readonly` **state**: [`SubscriptionQuantityReconciliationState`](/api/billing-core/src/type-aliases/subscriptionquantityreconciliationstate/)

***

### subscriptionId

> `readonly` **subscriptionId**: `string`

***

### tenantId

> `readonly` **tenantId**: `string`

***

### updatedAt

> `readonly` **updatedAt**: `Date`
