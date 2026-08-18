---
editUrl: false
next: false
prev: false
title: "InMemoryOutboundWebhookEndpointStore"
---

## Implements

- [`OutboundWebhookEndpointStore`](/api/webhooks-core/src/type-aliases/outboundwebhookendpointstore/)

## Constructors

### Constructor

> **new InMemoryOutboundWebhookEndpointStore**(`endpoints?`): `InMemoryOutboundWebhookEndpointStore`

#### Parameters

##### endpoints?

readonly [`OutboundWebhookEndpoint`](/api/webhooks-core/src/type-aliases/outboundwebhookendpoint/)[] = `[]`

#### Returns

`InMemoryOutboundWebhookEndpointStore`

## Methods

### getEndpoint()

> **getEndpoint**(`tenantId`, `endpointId`): `Promise`\<[`OutboundWebhookEndpoint`](/api/webhooks-core/src/type-aliases/outboundwebhookendpoint/) \| `undefined`\>

#### Parameters

##### tenantId

`string`

##### endpointId

`string`

#### Returns

`Promise`\<[`OutboundWebhookEndpoint`](/api/webhooks-core/src/type-aliases/outboundwebhookendpoint/) \| `undefined`\>

#### Implementation of

`OutboundWebhookEndpointStore.getEndpoint`

---

### listSubscribedEndpoints()

> **listSubscribedEndpoints**(`tenantId`, `eventName`): `Promise`\<readonly [`OutboundWebhookEndpoint`](/api/webhooks-core/src/type-aliases/outboundwebhookendpoint/)[]\>

#### Parameters

##### tenantId

`string`

##### eventName

`string`

#### Returns

`Promise`\<readonly [`OutboundWebhookEndpoint`](/api/webhooks-core/src/type-aliases/outboundwebhookendpoint/)[]\>

#### Implementation of

`OutboundWebhookEndpointStore.listSubscribedEndpoints`

---

### set()

> **set**(`endpoint`): `void`

#### Parameters

##### endpoint

[`OutboundWebhookEndpoint`](/api/webhooks-core/src/type-aliases/outboundwebhookendpoint/)

#### Returns

`void`
