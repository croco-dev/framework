---
editUrl: false
next: false
prev: false
title: "BillingGatewayConformanceAssertions"
---

> **BillingGatewayConformanceAssertions**\<`TGateway`\> = `object`

## Type Parameters

### TGateway

`TGateway` *extends* [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/) = [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/)

## Properties

### checkout()?

> `readonly` `optional` **checkout**: (`result`, `context`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### result

[`CheckoutResult`](/api/billing-core/src/type-aliases/checkoutresult/)

##### context

###### gateway

`TGateway`

###### params

[`CreateCheckoutParams`](/api/billing-core/src/type-aliases/createcheckoutparams/)

###### providerName

`string`

#### Returns

`void` \| `Promise`\<`void`\>

***

### customerPortal()?

> `readonly` `optional` **customerPortal**: (`portalUrl`, `context`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### portalUrl

`string`

##### context

###### billingAccountId

`string`

###### customerId

`string`

###### gateway

`TGateway`

###### providerName

`string`

#### Returns

`void` \| `Promise`\<`void`\>

***

### subscriptionLifecycle()?

> `readonly` `optional` **subscriptionLifecycle**: (`context`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### context

###### externalSubscriptionId

`string`

###### gateway

`TGateway`

###### providerName

`string`

#### Returns

`void` \| `Promise`\<`void`\>
