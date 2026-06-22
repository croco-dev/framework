---
editUrl: false
next: false
prev: false
title: "WebhookProviderAdapterConformanceOptions"
---

> **WebhookProviderAdapterConformanceOptions**\<`TEvent`\> = `object`

## Type Parameters

### TEvent

`TEvent` _extends_ [`WebhookEvent`](/api/webhooks-core/src/type-aliases/webhookevent/) = [`WebhookEvent`](/api/webhooks-core/src/type-aliases/webhookevent/)

## Properties

### createAdapter

> `readonly` **createAdapter**: () => `Promise`\<[`WebhookProviderAdapter`](/api/webhooks-core/src/type-aliases/webhookprovideradapter/)\<`TEvent`\>\> \| [`WebhookProviderAdapter`](/api/webhooks-core/src/type-aliases/webhookprovideradapter/)\<`TEvent`\>

#### Returns

`Promise`\<[`WebhookProviderAdapter`](/api/webhooks-core/src/type-aliases/webhookprovideradapter/)\<`TEvent`\>\> \| [`WebhookProviderAdapter`](/api/webhooks-core/src/type-aliases/webhookprovideradapter/)\<`TEvent`\>

---

### createIdempotencyStore?

> `readonly` `optional` **createIdempotencyStore?**: () => `Promise`\<[`IdempotencyStore`](/api/idempotency-core/src/type-aliases/idempotencystore/)\<[`WebhookGatewayStoredResult`](/api/webhooks-core/src/type-aliases/webhookgatewaystoredresult/)\>\> \| [`IdempotencyStore`](/api/idempotency-core/src/type-aliases/idempotencystore/)\<[`WebhookGatewayStoredResult`](/api/webhooks-core/src/type-aliases/webhookgatewaystoredresult/)\>

#### Returns

`Promise`\<[`IdempotencyStore`](/api/idempotency-core/src/type-aliases/idempotencystore/)\<[`WebhookGatewayStoredResult`](/api/webhooks-core/src/type-aliases/webhookgatewaystoredresult/)\>\> \| [`IdempotencyStore`](/api/idempotency-core/src/type-aliases/idempotencystore/)\<[`WebhookGatewayStoredResult`](/api/webhooks-core/src/type-aliases/webhookgatewaystoredresult/)\>

---

### expectedEvent

> `readonly` **expectedEvent**: `object`

#### id

> `readonly` **id**: `string`

#### provider?

> `readonly` `optional` **provider?**: `string`

#### type

> `readonly` **type**: `TEvent`\[`"type"`\] & `string`

---

### invalidSignatureRequest

> `readonly` **invalidSignatureRequest**: [`WebhookGatewayRequest`](/api/webhooks-core/src/type-aliases/webhookgatewayrequest/)

---

### validRequest

> `readonly` **validRequest**: [`WebhookGatewayRequest`](/api/webhooks-core/src/type-aliases/webhookgatewayrequest/)
