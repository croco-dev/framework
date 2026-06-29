---
editUrl: false
next: false
prev: false
title: "BillingWebhookConformanceOptions"
---

> **BillingWebhookConformanceOptions**\<`TResult`, `THandler`\> = `object`

## Type Parameters

### TResult

`TResult` *extends* [`BillingWebhookResult`](/api/testing/src/type-aliases/billingwebhookresult/) = [`BillingWebhookResult`](/api/testing/src/type-aliases/billingwebhookresult/)

### THandler

`THandler` *extends* [`BillingWebhookHandlerContract`](/api/testing/src/type-aliases/billingwebhookhandlercontract/)\<`TResult`\> = [`BillingWebhookHandlerContract`](/api/testing/src/type-aliases/billingwebhookhandlercontract/)\<`TResult`\>

## Properties

### assertions?

> `readonly` `optional` **assertions?**: [`BillingWebhookConformanceAssertions`](/api/testing/src/type-aliases/billingwebhookconformanceassertions/)\<`TResult`, `THandler`\>

***

### createHandler

> `readonly` **createHandler**: () => `THandler` \| `Promise`\<`THandler`\>

#### Returns

`THandler` \| `Promise`\<`THandler`\>

***

### fixtures

> `readonly` **fixtures**: `object`

#### invalidPayload?

> `readonly` `optional` **invalidPayload?**: [`BillingWebhookFixture`](/api/testing/src/type-aliases/billingwebhookfixture/)

#### invalidSignature

> `readonly` **invalidSignature**: [`BillingWebhookFixture`](/api/testing/src/type-aliases/billingwebhookfixture/)

#### order

> `readonly` **order**: [`BillingWebhookFixture`](/api/testing/src/type-aliases/billingwebhookfixture/)

#### subscription

> `readonly` **subscription**: [`BillingWebhookFixture`](/api/testing/src/type-aliases/billingwebhookfixture/)
