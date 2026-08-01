---
editUrl: false
next: false
prev: false
title: "InMemorySubscriptionQuantityReconciliationStore"
---

In-memory reconciliation intent store for tests and local composition.

## Implements

- [`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/)

## Constructors

### Constructor

> **new InMemorySubscriptionQuantityReconciliationStore**(`clock?`): `InMemorySubscriptionQuantityReconciliationStore`

#### Parameters

##### clock?

() => `Date`

#### Returns

`InMemorySubscriptionQuantityReconciliationStore`

## Methods

### createOrSupersede()

> **createOrSupersede**(`intent`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)\>

#### Parameters

##### intent

[`CreateSubscriptionQuantityIntent`](/api/billing-core/src/type-aliases/createsubscriptionquantityintent/)

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)\>

#### Implementation of

[`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/).[`createOrSupersede`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/#createorsupersede)

***

### findCurrent()

> **findCurrent**(`tenantId`, `externalSubscriptionId`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### externalSubscriptionId

`string`

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/) \| `null`\>

#### Implementation of

[`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/).[`findCurrent`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/#findcurrent)

***

### getDiagnostics()

> **getDiagnostics**(`options`): `Promise`\<[`SubscriptionQuantityDiagnostics`](/api/billing-core/src/type-aliases/subscriptionquantitydiagnostics/)\>

#### Parameters

##### options

###### maxAttempts

`number`

###### sampleLimit

`number`

#### Returns

`Promise`\<[`SubscriptionQuantityDiagnostics`](/api/billing-core/src/type-aliases/subscriptionquantitydiagnostics/)\>

#### Implementation of

[`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/).[`getDiagnostics`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/#getdiagnostics)

***

### listRecent()

> **listRecent**(`limit`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)[]\>

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)[]\>

#### Implementation of

[`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/).[`listRecent`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/#listrecent)

***

### listRepairable()

> **listRepairable**(`limit`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)[]\>

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)[]\>

#### Implementation of

[`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/).[`listRepairable`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/#listrepairable)

***

### saveIfCurrent()

> **saveIfCurrent**(`snapshot`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/) \| `null`\>

#### Parameters

##### snapshot

[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/) \| `null`\>

#### Implementation of

[`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/).[`saveIfCurrent`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/#saveifcurrent)
