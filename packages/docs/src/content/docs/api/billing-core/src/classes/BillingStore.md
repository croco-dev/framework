---
editUrl: false
next: false
prev: false
title: "BillingStore"
---

Abstract storage for billing data.
The framework provides `InMemoryBillingStore`; applications may supply persistent adapters.

## Extended by

- [`InMemoryBillingStore`](/api/billing-core/src/classes/inmemorybillingstore/)

## Constructors

### Constructor

> **new BillingStore**(): `BillingStore`

#### Returns

`BillingStore`

## Methods

### completeWebhook()

> `abstract` **completeWebhook**(`eventId`): `Promise`\<`void`\>

#### Parameters

##### eventId

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteAccount()

> `abstract` **deleteAccount**(`billingAccountId`): `Promise`\<`void`\>

#### Parameters

##### billingAccountId

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteSubscription()

> `abstract` **deleteSubscription**(`billingAccountId`): `Promise`\<`void`\>

#### Parameters

##### billingAccountId

`string`

#### Returns

`Promise`\<`void`\>

---

### failWebhook()

> `abstract` **failWebhook**(`eventId`): `Promise`\<`void`\>

#### Parameters

##### eventId

`string`

#### Returns

`Promise`\<`void`\>

---

### findAccountByExternalId()

> `abstract` **findAccountByExternalId**(`externalCustomerId`): `Promise`\<[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/) \| `null`\>

#### Parameters

##### externalCustomerId

`string`

#### Returns

`Promise`\<[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/) \| `null`\>

---

### findAccountByTenantId()

> `abstract` **findAccountByTenantId**(`tenantId`): `Promise`\<[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/) \| `null`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/) \| `null`\>

---

### findOrdersByAccount()

> `abstract` **findOrdersByAccount**(`billingAccountId`): `Promise`\<[`Order`](/api/billing-core/src/type-aliases/order/)[]\>

#### Parameters

##### billingAccountId

`string`

#### Returns

`Promise`\<[`Order`](/api/billing-core/src/type-aliases/order/)[]\>

---

### findSubscription()

> `abstract` **findSubscription**(`billingAccountId`): `Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`\>

#### Parameters

##### billingAccountId

`string`

#### Returns

`Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`\>

---

### findSubscriptionByExternalId()

> `abstract` **findSubscriptionByExternalId**(`externalSubscriptionId`): `Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`\>

#### Parameters

##### externalSubscriptionId

`string`

#### Returns

`Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`\>

---

### reserveWebhook()

> `abstract` **reserveWebhook**(`eventId`, `eventType`): `Promise`\<`void`\>

Reserves a provider webhook event for processing.

Store adapters must throw `WebhookAlreadyProcessedProblem` only when the exact event ID
reservation already exists. Other storage failures must retain their original failure semantics.

#### Parameters

##### eventId

`string`

##### eventType

`string`

#### Returns

`Promise`\<`void`\>

---

### saveAccount()

> `abstract` **saveAccount**(`account`): `Promise`\<`void`\>

#### Parameters

##### account

[`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/)

#### Returns

`Promise`\<`void`\>

---

### saveOrder()

> `abstract` **saveOrder**(`order`): `Promise`\<`void`\>

#### Parameters

##### order

[`Order`](/api/billing-core/src/type-aliases/order/)

#### Returns

`Promise`\<`void`\>

---

### saveSubscription()

> `abstract` **saveSubscription**(`subscription`): `Promise`\<`void`\>

#### Parameters

##### subscription

[`Subscription`](/api/billing-core/src/type-aliases/subscription/)

#### Returns

`Promise`\<`void`\>
