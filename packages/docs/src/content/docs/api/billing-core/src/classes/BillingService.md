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

> **cancelSubscription**(`params`): `Promise`\<[`BillingLifecycleCommand`](/api/billing-core/src/type-aliases/billinglifecyclecommand/)\>

Persist and execute a provider-idempotent cancellation command.

The returned command may remain `pending_provider` or `pending_local` when reconciliation is
required. Callers must not interpret promise fulfillment as an atomic cross-system commit.

#### Parameters

##### params

[`CancelSubscriptionParams`](/api/billing-core/src/type-aliases/cancelsubscriptionparams/)

#### Returns

`Promise`\<[`BillingLifecycleCommand`](/api/billing-core/src/type-aliases/billinglifecyclecommand/)\>

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

> **getSubscription**(`tenantId`): `Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`\>

Get full subscription details.

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`\>

***

### getSubscriptionStatus()

> **getSubscriptionStatus**(`tenantId`): `Promise`\<[`SubscriptionStatus`](/api/billing-core/src/type-aliases/subscriptionstatus/) \| `null`\>

Get subscription status for a tenant.

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`SubscriptionStatus`](/api/billing-core/src/type-aliases/subscriptionstatus/) \| `null`\>

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

### reconcileLifecycleCommand()

> **reconcileLifecycleCommand**(`idempotencyKey`): `Promise`\<[`BillingLifecycleCommand`](/api/billing-core/src/type-aliases/billinglifecyclecommand/)\>

Retry one durable lifecycle command from its persisted reconciliation state.

#### Parameters

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`BillingLifecycleCommand`](/api/billing-core/src/type-aliases/billinglifecyclecommand/)\>

***

### reconcilePendingLifecycleCommands()

> **reconcilePendingLifecycleCommands**(`limit?`): `Promise`\<[`ReconcileBillingLifecycleCommandsResult`](/api/billing-core/src/type-aliases/reconcilebillinglifecyclecommandsresult/)\>

Retry a bounded, deterministic batch of incomplete lifecycle commands.

#### Parameters

##### limit?

`number` = `DEFAULT_RECONCILIATION_LIMIT`

#### Returns

`Promise`\<[`ReconcileBillingLifecycleCommandsResult`](/api/billing-core/src/type-aliases/reconcilebillinglifecyclecommandsresult/)\>

***

### resumeSubscription()

> **resumeSubscription**(`params`): `Promise`\<[`BillingLifecycleCommand`](/api/billing-core/src/type-aliases/billinglifecyclecommand/)\>

Persist and execute a provider-idempotent resume command.

#### Parameters

##### params

[`ResumeSubscriptionParams`](/api/billing-core/src/type-aliases/resumesubscriptionparams/)

#### Returns

`Promise`\<[`BillingLifecycleCommand`](/api/billing-core/src/type-aliases/billinglifecyclecommand/)\>
