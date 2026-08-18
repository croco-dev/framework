---
editUrl: false
next: false
prev: false
title: "createBillingProviderConformanceSuite"
---

> **createBillingProviderConformanceSuite**\<`TGateway`, `TResult`, `THandler`\>(`options`): [`BillingProviderConformanceSuite`](/api/testing/src/type-aliases/billingproviderconformancesuite/)

## Type Parameters

### TGateway

`TGateway` _extends_ [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/) = [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/)

### TResult

`TResult` _extends_ [`BillingWebhookResult`](/api/testing/src/type-aliases/billingwebhookresult/) = [`BillingWebhookResult`](/api/testing/src/type-aliases/billingwebhookresult/)

### THandler

`THandler` _extends_ [`BillingWebhookHandlerContract`](/api/testing/src/type-aliases/billingwebhookhandlercontract/)\<`TResult`\> = [`BillingWebhookHandlerContract`](/api/testing/src/type-aliases/billingwebhookhandlercontract/)\<`TResult`\>

## Parameters

### options

[`BillingProviderConformanceOptions`](/api/testing/src/type-aliases/billingproviderconformanceoptions/)\<`TGateway`, `TResult`, `THandler`\>

## Returns

[`BillingProviderConformanceSuite`](/api/testing/src/type-aliases/billingproviderconformancesuite/)
