---
editUrl: false
next: false
prev: false
title: "OutboundWebhookEndpointStore"
---

> **OutboundWebhookEndpointStore** = `object`

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
