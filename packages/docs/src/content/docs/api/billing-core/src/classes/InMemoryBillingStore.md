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

> **new InMemoryBillingStore**(): `InMemoryBillingStore`

#### Returns

`InMemoryBillingStore`

#### Inherited from

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`constructor`](/api/billing-core/src/classes/billingstore/#constructor)

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

***

### deleteAccount()

> **deleteAccount**(`billingAccountId`): `Promise`\<`void`\>

#### Parameters

##### billingAccountId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`deleteAccount`](/api/billing-core/src/classes/billingstore/#deleteaccount)

***

### deleteSubscription()

> **deleteSubscription**(`billingAccountId`): `Promise`\<`void`\>

#### Parameters

##### billingAccountId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`deleteSubscription`](/api/billing-core/src/classes/billingstore/#deletesubscription)

***

### failWebhook()

> **failWebhook**(`eventId`): `Promise`\<`void`\>

#### Parameters

##### eventId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`failWebhook`](/api/billing-core/src/classes/billingstore/#failwebhook)

***

### findAccountByExternalId()

> **findAccountByExternalId**(`externalCustomerId`): `Promise`\<[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/)\>

#### Parameters

##### externalCustomerId

`string`

#### Returns

`Promise`\<[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/)\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`findAccountByExternalId`](/api/billing-core/src/classes/billingstore/#findaccountbyexternalid)

***

### findAccountByTenantId()

> **findAccountByTenantId**(`tenantId`): `Promise`\<[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/)\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/)\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`findAccountByTenantId`](/api/billing-core/src/classes/billingstore/#findaccountbytenantid)

***

### findOrdersByAccount()

> **findOrdersByAccount**(`billingAccountId`): `Promise`\<[`Order`](/api/billing-core/src/type-aliases/order/)[]\>

#### Parameters

##### billingAccountId

`string`

#### Returns

`Promise`\<[`Order`](/api/billing-core/src/type-aliases/order/)[]\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`findOrdersByAccount`](/api/billing-core/src/classes/billingstore/#findordersbyaccount)

***

### findSubscription()

> **findSubscription**(`billingAccountId`): `Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/)\>

#### Parameters

##### billingAccountId

`string`

#### Returns

`Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/)\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`findSubscription`](/api/billing-core/src/classes/billingstore/#findsubscription)

***

### findSubscriptionByExternalId()

> **findSubscriptionByExternalId**(`externalSubscriptionId`): `Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/)\>

#### Parameters

##### externalSubscriptionId

`string`

#### Returns

`Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/)\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`findSubscriptionByExternalId`](/api/billing-core/src/classes/billingstore/#findsubscriptionbyexternalid)

***

### reserveWebhook()

> **reserveWebhook**(`eventId`, `_eventType`): `Promise`\<`void`\>

#### Parameters

##### eventId

`string`

##### \_eventType

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`reserveWebhook`](/api/billing-core/src/classes/billingstore/#reservewebhook)

***

### reset()

> **reset**(): `void`

Clear all data (for testing)

#### Returns

`void`

***

### saveAccount()

> **saveAccount**(`account`): `Promise`\<`void`\>

#### Parameters

##### account

[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/)

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`saveAccount`](/api/billing-core/src/classes/billingstore/#saveaccount)

***

### saveOrder()

> **saveOrder**(`order`): `Promise`\<`void`\>

#### Parameters

##### order

[`Order`](/api/billing-core/src/type-aliases/order/)

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`saveOrder`](/api/billing-core/src/classes/billingstore/#saveorder)

***

### saveSubscription()

> **saveSubscription**(`subscription`): `Promise`\<`void`\>

#### Parameters

##### subscription

[`Subscription`](/api/billing-core/src/type-aliases/subscription/)

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BillingStore`](/api/billing-core/src/classes/billingstore/).[`saveSubscription`](/api/billing-core/src/classes/billingstore/#savesubscription)
