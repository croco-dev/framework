---
editUrl: false
next: false
prev: false
title: "BillingGateway"
---

Abstract interface for billing provider operations.
Implementations: PolarBillingGateway

## Methods

### cancelSubscription()

> **cancelSubscription**(`externalSubscriptionId`, `immediate?`): `Promise`\<`void`\>

#### Parameters

##### externalSubscriptionId

`string`

##### immediate?

`boolean`

#### Returns

`Promise`\<`void`\>

***

### createCheckout()

> **createCheckout**(`params`): `Promise`\<[`CheckoutResult`](/api/billing-core/src/type-aliases/checkoutresult/)\>

#### Parameters

##### params

[`CreateCheckoutParams`](/api/billing-core/src/type-aliases/createcheckoutparams/)

#### Returns

`Promise`\<[`CheckoutResult`](/api/billing-core/src/type-aliases/checkoutresult/)\>

***

### ensureCustomer()

> **ensureCustomer**(`billingAccountId`, `email`): `Promise`\<`string`\>

#### Parameters

##### billingAccountId

`string`

##### email

`string`

#### Returns

`Promise`\<`string`\>

***

### getCustomerPortalUrl()

> **getCustomerPortalUrl**(`externalCustomerId`): `Promise`\<`string`\>

#### Parameters

##### externalCustomerId

`string`

#### Returns

`Promise`\<`string`\>

***

### resumeSubscription()

> **resumeSubscription**(`externalSubscriptionId`): `Promise`\<`void`\>

#### Parameters

##### externalSubscriptionId

`string`

#### Returns

`Promise`\<`void`\>
