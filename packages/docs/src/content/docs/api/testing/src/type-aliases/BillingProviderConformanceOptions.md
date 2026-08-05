---
editUrl: false
next: false
prev: false
title: "BillingProviderConformanceOptions"
---

> **BillingProviderConformanceOptions**\<`TGateway`, `TResult`, `THandler`\> = `object`

## Type Parameters

### TGateway

`TGateway` *extends* [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/) = [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/)

### TResult

`TResult` *extends* [`BillingWebhookResult`](/api/testing/src/type-aliases/billingwebhookresult/) = [`BillingWebhookResult`](/api/testing/src/type-aliases/billingwebhookresult/)

### THandler

`THandler` *extends* [`BillingWebhookHandlerContract`](/api/testing/src/type-aliases/billingwebhookhandlercontract/)\<`TResult`\> = [`BillingWebhookHandlerContract`](/api/testing/src/type-aliases/billingwebhookhandlercontract/)\<`TResult`\>

## Properties

### capabilities?

> `readonly` `optional` **capabilities?**: [`BillingProviderCapabilityConformanceOptions`](/api/testing/src/type-aliases/billingprovidercapabilityconformanceoptions/)

***

### gateway?

> `readonly` `optional` **gateway?**: [`BillingGatewayConformanceOptions`](/api/testing/src/type-aliases/billinggatewayconformanceoptions/)\<`TGateway`\>

***

### licensedQuantity?

> `readonly` `optional` **licensedQuantity?**: [`LicensedQuantityGatewayConformanceOptions`](/api/testing/src/type-aliases/licensedquantitygatewayconformanceoptions/)

***

### providerName

> `readonly` **providerName**: `string`

***

### unavailableUsage?

> `readonly` `optional` **unavailableUsage?**: [`UnavailableUsageBillingCapabilityConformanceOptions`](/api/testing/src/type-aliases/unavailableusagebillingcapabilityconformanceoptions/)

***

### usage?

> `readonly` `optional` **usage?**: [`UsageBillingGatewayConformanceOptions`](/api/testing/src/type-aliases/usagebillinggatewayconformanceoptions/)

***

### webhook?

> `readonly` `optional` **webhook?**: [`BillingWebhookConformanceOptions`](/api/testing/src/type-aliases/billingwebhookconformanceoptions/)\<`TResult`, `THandler`\>
