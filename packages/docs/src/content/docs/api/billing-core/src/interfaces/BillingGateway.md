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

### reconcileCheckout()

> **reconcileCheckout**(`params`): `Promise`\<[`CheckoutResult`](/api/billing-core/src/type-aliases/checkoutresult/) \| `null`\>

Look up a previously accepted checkout without creating another provider session.
Used to recover ambiguous provider responses and idempotency-store commit failures.

#### Parameters

##### params

[`CreateCheckoutParams`](/api/billing-core/src/type-aliases/createcheckoutparams/)

#### Returns

`Promise`\<[`CheckoutResult`](/api/billing-core/src/type-aliases/checkoutresult/) \| `null`\>

***

### resumeSubscription()

> **resumeSubscription**(`externalSubscriptionId`, `options`): `Promise`\<`void`\>

#### Parameters

##### externalSubscriptionId

`string`

##### options

[`BillingLifecycleGatewayOptions`](/api/billing-core/src/type-aliases/billinglifecyclegatewayoptions/)

#### Returns

`Promise`\<`void`\>
