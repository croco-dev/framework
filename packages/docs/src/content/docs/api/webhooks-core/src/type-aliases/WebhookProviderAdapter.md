---
editUrl: false
next: false
prev: false
title: "WebhookProviderAdapter"
---

> **WebhookProviderAdapter**\<`TEvent`\> = `object`

## Type Parameters

### TEvent

`TEvent` *extends* [`WebhookEvent`](/api/webhooks-core/src/type-aliases/webhookevent/) = [`WebhookEvent`](/api/webhooks-core/src/type-aliases/webhookevent/)

## Properties

### provider

> `readonly` **provider**: `string`

## Methods

### verify()

> **verify**(`request`): `TEvent` \| `Promise`\<`TEvent`\>

#### Parameters

##### request

###### headers

[`NormalizedWebhookHeaders`](/api/webhooks-core/src/type-aliases/normalizedwebhookheaders/)

###### metadata?

`Record`\<`string`, `unknown`\>

###### rawBody

[`WebhookRawBody`](/api/webhooks-core/src/type-aliases/webhookrawbody/)

###### receivedAt

`Date`

#### Returns

`TEvent` \| `Promise`\<`TEvent`\>
