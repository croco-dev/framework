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

> **cancelSubscription**(`externalSubscriptionId`, `immediate`, `options`): `Promise`\<`void`\>

#### Parameters

##### externalSubscriptionId

`string`

##### immediate

`boolean`

##### options

[`BillingLifecycleGatewayOptions`](/api/billing-core/src/type-aliases/billinglifecyclegatewayoptions/)

#### Returns

`Promise`\<`void`\>

---

### createCheckout()

> **createCheckout**(`params`): `Promise`\<[`CheckoutResult`](/api/billing-core/src/type-aliases/checkoutresult/)\>

#### Parameters

##### params

[`CreateCheckoutParams`](/api/billing-core/src/type-aliases/createcheckoutparams/)

#### Returns

`Promise`\<[`CheckoutResult`](/api/billing-core/src/type-aliases/checkoutresult/)\>

---

### ensureCustomer()

> **ensureCustomer**(`billingAccountId`, `email`): `Promise`\<`string`\>

#### Parameters

##### billingAccountId

`string`

##### email

`string`

#### Returns

`Promise`\<`string`\>

---

### getCustomerPortalUrl()

> **getCustomerPortalUrl**(`externalCustomerId`): `Promise`\<`string`\>

#### Parameters

##### externalCustomerId

`string`

#### Returns

`Promise`\<`string`\>

---

### resumeSubscription()

> **resumeSubscription**(`externalSubscriptionId`, `options`): `Promise`\<`void`\>

#### Parameters

##### externalSubscriptionId

`string`

##### options

[`BillingLifecycleGatewayOptions`](/api/billing-core/src/type-aliases/billinglifecyclegatewayoptions/)

#### Returns

`Promise`\<`void`\>
