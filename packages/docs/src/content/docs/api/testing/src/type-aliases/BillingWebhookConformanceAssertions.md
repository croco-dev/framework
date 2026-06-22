---
editUrl: false
next: false
prev: false
title: "BillingWebhookConformanceAssertions"
---

> **BillingWebhookConformanceAssertions**\<`TResult`, `THandler`\> = `object`

## Type Parameters

### TResult

`TResult` _extends_ [`BillingWebhookResult`](/api/testing/src/type-aliases/billingwebhookresult/) = [`BillingWebhookResult`](/api/testing/src/type-aliases/billingwebhookresult/)

### THandler

`THandler` _extends_ [`BillingWebhookHandlerContract`](/api/testing/src/type-aliases/billingwebhookhandlercontract/)\<`TResult`\> = [`BillingWebhookHandlerContract`](/api/testing/src/type-aliases/billingwebhookhandlercontract/)\<`TResult`\>

## Properties

### idempotency?

> `readonly` `optional` **idempotency?**: (`results`, `context`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### results

readonly \[`TResult`, `TResult`\]

##### context

###### fixture

[`BillingWebhookFixture`](/api/testing/src/type-aliases/billingwebhookfixture/)

###### handler

`THandler`

###### providerName

`string`

#### Returns

`void` \| `Promise`\<`void`\>

---

### invalidPayload?

> `readonly` `optional` **invalidPayload?**: (`problem`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### problem

[`Problem`](/api/problems-core/src/classes/problem/)

#### Returns

`void` \| `Promise`\<`void`\>

---

### invalidSignature?

> `readonly` `optional` **invalidSignature?**: (`problem`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### problem

[`Problem`](/api/problems-core/src/classes/problem/)

#### Returns

`void` \| `Promise`\<`void`\>

---

### order?

> `readonly` `optional` **order?**: (`result`, `context`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### result

`TResult`

##### context

###### fixture

[`BillingWebhookFixture`](/api/testing/src/type-aliases/billingwebhookfixture/)

###### handler

`THandler`

###### providerName

`string`

#### Returns

`void` \| `Promise`\<`void`\>

---

### subscription?

> `readonly` `optional` **subscription?**: (`result`, `context`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### result

`TResult`

##### context

###### fixture

[`BillingWebhookFixture`](/api/testing/src/type-aliases/billingwebhookfixture/)

###### handler

`THandler`

###### providerName

`string`

#### Returns

`void` \| `Promise`\<`void`\>
