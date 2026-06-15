---
editUrl: false
next: false
prev: false
title: "BillingService"
---

Billing service for subscription management.
Orchestrates store and gateway operations.

## Constructors

### Constructor

> **new BillingService**(`deps`): `BillingService`

#### Parameters

##### deps

[`BillingServiceDependencies`](/api/billing-core/src/type-aliases/billingservicedependencies/)

#### Returns

`BillingService`

## Methods

### cancelSubscription()

> **cancelSubscription**(`tenantId`, `immediate?`): `Promise`\<`void`\>

Cancel a subscription (at period end by default).

#### Parameters

##### tenantId

`string`

##### immediate?

`boolean` = `false`

#### Returns

`Promise`\<`void`\>

***

### createCheckout()

> **createCheckout**(`params`): `Promise`\<\{ `checkoutUrl`: `string`; \}\>

Create a checkout session for a tenant.

#### Parameters

##### params

[`CreateBillingCheckoutParams`](/api/billing-core/src/type-aliases/createbillingcheckoutparams/)

#### Returns

`Promise`\<\{ `checkoutUrl`: `string`; \}\>

***

### getCustomerPortalUrl()

> **getCustomerPortalUrl**(`tenantId`): `Promise`\<`string`\>

Get customer portal URL.

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`string`\>

***

### getSubscription()

> **getSubscription**(`tenantId`): `Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/)\>

Get full subscription details.

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/)\>

***

### getSubscriptionStatus()

> **getSubscriptionStatus**(`tenantId`): `Promise`\<[`SubscriptionStatus`](/api/billing-core/src/type-aliases/subscriptionstatus/)\>

Get subscription status for a tenant.

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`SubscriptionStatus`](/api/billing-core/src/type-aliases/subscriptionstatus/)\>

***

### hasActiveSubscription()

> **hasActiveSubscription**(`tenantId`): `Promise`\<`boolean`\>

Check if a tenant has an active subscription.

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### resumeSubscription()

> **resumeSubscription**(`tenantId`): `Promise`\<`void`\>

Resume a canceled subscription.

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`void`\>
