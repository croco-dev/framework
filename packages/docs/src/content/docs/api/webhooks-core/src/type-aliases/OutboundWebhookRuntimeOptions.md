---
editUrl: false
next: false
prev: false
title: "OutboundWebhookRuntimeOptions"
---

> **OutboundWebhookRuntimeOptions** = `object`

## Properties

### createId?

> `readonly` `optional` **createId?**: () => `string`

#### Returns

`string`

***

### endpointStore

> `readonly` **endpointStore**: [`OutboundWebhookEndpointStore`](/api/webhooks-core/src/type-aliases/outboundwebhookendpointstore/)

***

### now?

> `readonly` `optional` **now?**: () => `Date`

#### Returns

`Date`

***

### pausePolicy?

> `readonly` `optional` **pausePolicy?**: [`OutboundWebhookPausePolicy`](/api/webhooks-core/src/type-aliases/outboundwebhookpausepolicy/)

***

### retryPolicy?

> `readonly` `optional` **retryPolicy?**: [`OutboundWebhookRetryPolicy`](/api/webhooks-core/src/type-aliases/outboundwebhookretrypolicy/)

***

### secretStore

> `readonly` **secretStore**: [`OutboundWebhookSecretStore`](/api/webhooks-core/src/type-aliases/outboundwebhooksecretstore/)

***

### store

> `readonly` **store**: [`OutboundWebhookStore`](/api/webhooks-core/src/type-aliases/outboundwebhookstore/)

***

### taskPublisher

> `readonly` **taskPublisher**: [`OutboundWebhookTaskPublisher`](/api/webhooks-core/src/type-aliases/outboundwebhooktaskpublisher/)

***

### transport

> `readonly` **transport**: [`OutboundWebhookTransport`](/api/webhooks-core/src/type-aliases/outboundwebhooktransport/)

***

### urlPolicy?

> `readonly` `optional` **urlPolicy?**: [`OutboundWebhookUrlPolicy`](/api/webhooks-core/src/type-aliases/outboundwebhookurlpolicy/)
