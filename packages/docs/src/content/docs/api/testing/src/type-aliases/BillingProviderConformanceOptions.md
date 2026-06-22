---
editUrl: false
next: false
prev: false
title: "BillingProviderConformanceOptions"
---

> **BillingProviderConformanceOptions**\<`TGateway`, `TResult`, `THandler`\> = `object`

## Type Parameters

### TGateway

`TGateway` _extends_ [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/) = [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/)

### TResult

`TResult` _extends_ [`BillingWebhookResult`](/api/testing/src/type-aliases/billingwebhookresult/) = [`BillingWebhookResult`](/api/testing/src/type-aliases/billingwebhookresult/)

### THandler

`THandler` _extends_ [`BillingWebhookHandlerContract`](/api/testing/src/type-aliases/billingwebhookhandlercontract/)\<`TResult`\> = [`BillingWebhookHandlerContract`](/api/testing/src/type-aliases/billingwebhookhandlercontract/)\<`TResult`\>

## Properties

### gateway?

> `readonly` `optional` **gateway?**: [`BillingGatewayConformanceOptions`](/api/testing/src/type-aliases/billinggatewayconformanceoptions/)\<`TGateway`\>

---

### providerName

> `readonly` **providerName**: `string`

---

### webhook?

> `readonly` `optional` **webhook?**: [`BillingWebhookConformanceOptions`](/api/testing/src/type-aliases/billingwebhookconformanceoptions/)\<`TResult`, `THandler`\>
