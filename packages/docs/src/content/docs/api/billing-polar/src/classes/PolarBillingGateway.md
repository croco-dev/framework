---
editUrl: false
next: false
prev: false
title: "PolarBillingGateway"
---

Polar billing gateway implementation.

Integrates with Polar API for checkout creation, subscription management,
and payment processing.

## Example

```typescript
import { PolarBillingGateway, PolarConfig } from '@croco/billing-polar';

const config: PolarConfig = {
  accessToken: 'polar_access_token',
  environment: 'sandbox',
  webhookSecret: 'whsec_...',
};

const gateway = new PolarBillingGateway(config, logger);
const checkout = await gateway.createCheckout({
  billingAccountId: 'tenant_123',
  email: 'buyer@example.com',
  productId: 'prod_123',
  successUrl: 'https://example.com/success'
});
```

## Implements

- [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/)

## Constructors

### Constructor

> **new PolarBillingGateway**(`config`, `logger`): `PolarBillingGateway`

#### Parameters

##### config

[`PolarConfig`](/api/billing-polar/src/type-aliases/polarconfig/)

##### logger

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

#### Returns

`PolarBillingGateway`

## Methods

### cancelSubscription()

> **cancelSubscription**(`externalSubscriptionId`, `immediate?`): `Promise`\<`void`\>

#### Parameters

##### externalSubscriptionId

`string`

##### immediate?

`boolean` = `false`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/).[`cancelSubscription`](/api/billing-core/src/interfaces/billinggateway/#cancelsubscription)

***

### createCheckout()

> **createCheckout**(`params`): `Promise`\<[`CheckoutResult`](/api/billing-core/src/type-aliases/checkoutresult/)\>

#### Parameters

##### params

[`CreateCheckoutParams`](/api/billing-core/src/type-aliases/createcheckoutparams/)

#### Returns

`Promise`\<[`CheckoutResult`](/api/billing-core/src/type-aliases/checkoutresult/)\>

#### Implementation of

[`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/).[`createCheckout`](/api/billing-core/src/interfaces/billinggateway/#createcheckout)

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

#### Implementation of

[`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/).[`ensureCustomer`](/api/billing-core/src/interfaces/billinggateway/#ensurecustomer)

***

### getCustomerPortalUrl()

> **getCustomerPortalUrl**(`externalCustomerId`): `Promise`\<`string`\>

#### Parameters

##### externalCustomerId

`string`

#### Returns

`Promise`\<`string`\>

#### Implementation of

[`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/).[`getCustomerPortalUrl`](/api/billing-core/src/interfaces/billinggateway/#getcustomerportalurl)

***

### resumeSubscription()

> **resumeSubscription**(`externalSubscriptionId`): `Promise`\<`void`\>

#### Parameters

##### externalSubscriptionId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/).[`resumeSubscription`](/api/billing-core/src/interfaces/billinggateway/#resumesubscription)
