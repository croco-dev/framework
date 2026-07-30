---
editUrl: false
next: false
prev: false
title: "SubscriptionQuantityReconciler"
---

Persists and converges licensed-quantity reconciliation intents against a provider gateway.

## Constructors

### Constructor

> **new SubscriptionQuantityReconciler**(`dependencies`): `SubscriptionQuantityReconciler`

#### Parameters

##### dependencies

[`SubscriptionQuantityReconcilerDependencies`](/api/billing-core/src/type-aliases/subscriptionquantityreconcilerdependencies/)

#### Returns

`SubscriptionQuantityReconciler`

## Methods

### createIntent()

> **createIntent**(`input`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)\>

#### Parameters

##### input

[`ReconcileSubscriptionQuantityInput`](/api/billing-core/src/type-aliases/reconcilesubscriptionquantityinput/)

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)\>

***

### getDiagnostics()

> **getDiagnostics**(`limit?`): `Promise`\<[`SubscriptionQuantityDiagnostics`](/api/billing-core/src/type-aliases/subscriptionquantitydiagnostics/)\>

#### Parameters

##### limit?

`number` = `100`

#### Returns

`Promise`\<[`SubscriptionQuantityDiagnostics`](/api/billing-core/src/type-aliases/subscriptionquantitydiagnostics/)\>

***

### reconcile()

> **reconcile**(`input`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)\>

#### Parameters

##### input

[`ReconcileSubscriptionQuantityInput`](/api/billing-core/src/type-aliases/reconcilesubscriptionquantityinput/)

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)\>

***

### repair()

> **repair**(`limit`): `Promise`\<[`ReconcileSubscriptionQuantitiesResult`](/api/billing-core/src/type-aliases/reconcilesubscriptionquantitiesresult/)\>

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`ReconcileSubscriptionQuantitiesResult`](/api/billing-core/src/type-aliases/reconcilesubscriptionquantitiesresult/)\>
