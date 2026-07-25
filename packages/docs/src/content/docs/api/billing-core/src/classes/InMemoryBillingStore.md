---
editUrl: false
next: false
prev: false
title: "InMemoryBillingStore"
---

In-memory billing store for testing and development.
NOT suitable for production multi-instance deployments.

## Extends

- [`BillingStore`](/api/billing-core/src/classes/billingstore/)

## Constructors

### Constructor

> **new InMemoryBillingStore**(`planRegistry`): `InMemoryBillingStore`

#### Parameters

##### planRegistry

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/)

#### Returns

`InMemoryBillingStore`

#### Overrides

`BillingStore.constructor`

## Methods

### completeWebhook()

> **completeWebhook**(`eventId`): `Promise`\<`void`\>

#### Parameters

##### eventId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`completeWebhook`](/api/billing-core/src/classes/billingstore/#completewebhook)

---

### deleteAccount()

> **deleteAccount**(`billingAccountId`): `Promise`\<`void`\>

#### Parameters

##### billingAccountId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`deleteAccount`](/api/billing-core/src/classes/billingstore/#deleteaccount)

---

### deleteSubscription()

> **deleteSubscription**(`billingAccountId`): `Promise`\<`void`\>

#### Parameters

##### billingAccountId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`deleteSubscription`](/api/billing-core/src/classes/billingstore/#deletesubscription)

---

### failWebhook()

> **failWebhook**(`eventId`): `Promise`\<`void`\>

#### Parameters

##### eventId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`failWebhook`](/api/billing-core/src/classes/billingstore/#failwebhook)

---

### findAccountByExternalId()

> **findAccountByExternalId**(`externalCustomerId`): `Promise`\<[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/) \| `null`\>

#### Parameters

##### externalCustomerId

`string`

#### Returns

`Promise`\<[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/) \| `null`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`findAccountByExternalId`](/api/billing-core/src/classes/billingstore/#findaccountbyexternalid)

---

### findAccountByTenantId()

> **findAccountByTenantId**(`tenantId`): `Promise`\<[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/) \| `null`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/) \| `null`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`findAccountByTenantId`](/api/billing-core/src/classes/billingstore/#findaccountbytenantid)

---

### findLegacySubscriptions()

> **findLegacySubscriptions**(): `Promise`\<[`LegacySubscription`](/api/billing-core/src/type-aliases/legacysubscription/)[]\>

Returns only persisted records that predate plan-version pinning.

#### Returns

`Promise`\<[`LegacySubscription`](/api/billing-core/src/type-aliases/legacysubscription/)[]\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`findLegacySubscriptions`](/api/billing-core/src/classes/billingstore/#findlegacysubscriptions)

---

### findOrdersByAccount()

> **findOrdersByAccount**(`billingAccountId`): `Promise`\<[`Order`](/api/billing-core/src/type-aliases/order/)[]\>

#### Parameters

##### billingAccountId

`string`

#### Returns

`Promise`\<[`Order`](/api/billing-core/src/type-aliases/order/)[]\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`findOrdersByAccount`](/api/billing-core/src/classes/billingstore/#findordersbyaccount)

---

### findSubscription()

> **findSubscription**(`billingAccountId`): `Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`\>

#### Parameters

##### billingAccountId

`string`

#### Returns

`Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`findSubscription`](/api/billing-core/src/classes/billingstore/#findsubscription)

---

### findSubscriptionByExternalId()

> **findSubscriptionByExternalId**(`externalSubscriptionId`): `Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`\>

#### Parameters

##### externalSubscriptionId

`string`

#### Returns

`Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`findSubscriptionByExternalId`](/api/billing-core/src/classes/billingstore/#findsubscriptionbyexternalid)

---

### importLegacySubscription()

> **importLegacySubscription**(`subscription`): `void`

Loads a pre-plan-version record for migration tests and development fixtures.
New application writes must use saveSubscription with a pinned Subscription.

#### Parameters

##### subscription

[`LegacySubscription`](/api/billing-core/src/type-aliases/legacysubscription/)

#### Returns

`void`

---

### migrateSubscriptionPlanVersion()

> **migrateSubscriptionPlanVersion**(`migration`): `Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/)\>

Atomically pins one legacy record to the caller-selected version.
Adapters must not infer the latest version.

#### Parameters

##### migration

[`SubscriptionPlanVersionMigration`](/api/billing-core/src/type-aliases/subscriptionplanversionmigration/)

#### Returns

`Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/)\>

#### Inherited from

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`migrateSubscriptionPlanVersion`](/api/billing-core/src/classes/billingstore/#migratesubscriptionplanversion)

---

### reserveWebhook()

> **reserveWebhook**(`eventId`, `_eventType`): `Promise`\<`void`\>

Reserves a provider webhook event for processing.

Store adapters must throw `WebhookAlreadyProcessedProblem` only when the exact event ID
reservation already exists. Other storage failures must retain their original failure semantics.

#### Parameters

##### eventId

`string`

##### \_eventType

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`reserveWebhook`](/api/billing-core/src/classes/billingstore/#reservewebhook)

---

### reset()

> **reset**(): `void`

Clear all data (for testing)

#### Returns

`void`

---

### saveAccount()

> **saveAccount**(`account`): `Promise`\<`void`\>

#### Parameters

##### account

[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/)

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`saveAccount`](/api/billing-core/src/classes/billingstore/#saveaccount)

---

### saveOrder()

> **saveOrder**(`order`): `Promise`\<`void`\>

#### Parameters

##### order

[`Order`](/api/billing-core/src/type-aliases/order/)

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`saveOrder`](/api/billing-core/src/classes/billingstore/#saveorder)

---

### saveSubscription()

> **saveSubscription**(`subscription`): `Promise`\<`void`\>

#### Parameters

##### subscription

[`Subscription`](/api/billing-core/src/type-aliases/subscription/)

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`saveSubscription`](/api/billing-core/src/classes/billingstore/#savesubscription)
