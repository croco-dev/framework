---
editUrl: false
next: false
prev: false
title: "SubscriptionQuantityReconciliationStore"
---

## Methods

### createOrSupersede()

> **createOrSupersede**(`intent`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)\>

#### Parameters

##### intent

[`CreateSubscriptionQuantityIntent`](/api/billing-core/src/type-aliases/createsubscriptionquantityintent/)

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)\>

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

***

### listRecent()

> **listRecent**(`limit`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)[]\>

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)[]\>

***

### listRepairable()

> **listRepairable**(`limit`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)[]\>

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)[]\>

***

### saveIfCurrent()

> **saveIfCurrent**(`snapshot`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/) \| `null`\>

#### Parameters

##### snapshot

[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/) \| `null`\>
