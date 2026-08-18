---
editUrl: false
next: false
prev: false
title: "OutboundWebhookStoreConformanceOptions"
---

> **OutboundWebhookStoreConformanceOptions** = `object`

## Properties

### createStore

> `readonly` **createStore**: () => [`OutboundWebhookStore`](/api/webhooks-core/src/type-aliases/outboundwebhookstore/) \| `Promise`\<[`OutboundWebhookStore`](/api/webhooks-core/src/type-aliases/outboundwebhookstore/)\>

#### Returns

[`OutboundWebhookStore`](/api/webhooks-core/src/type-aliases/outboundwebhookstore/) \| `Promise`\<[`OutboundWebhookStore`](/api/webhooks-core/src/type-aliases/outboundwebhookstore/)\>

***

### endpoint

> `readonly` **endpoint**: [`OutboundWebhookEndpoint`](/api/webhooks-core/src/type-aliases/outboundwebhookendpoint/)

***

### event

> `readonly` **event**: [`OutboundWebhookEvent`](/api/webhooks-core/src/type-aliases/outboundwebhookevent/)

***

### reopenStore?

> `readonly` `optional` **reopenStore?**: (`store`) => [`OutboundWebhookStore`](/api/webhooks-core/src/type-aliases/outboundwebhookstore/) \| `Promise`\<[`OutboundWebhookStore`](/api/webhooks-core/src/type-aliases/outboundwebhookstore/)\>

#### Parameters

##### store

[`OutboundWebhookStore`](/api/webhooks-core/src/type-aliases/outboundwebhookstore/)

#### Returns

[`OutboundWebhookStore`](/api/webhooks-core/src/type-aliases/outboundwebhookstore/) \| `Promise`\<[`OutboundWebhookStore`](/api/webhooks-core/src/type-aliases/outboundwebhookstore/)\>
