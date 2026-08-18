---
editUrl: false
next: false
prev: false
title: "InMemoryOutboundWebhookSecretStore"
---

## Implements

- [`OutboundWebhookSecretStore`](/api/webhooks-core/src/type-aliases/outboundwebhooksecretstore/)

## Constructors

### Constructor

> **new InMemoryOutboundWebhookSecretStore**(`secrets?`): `InMemoryOutboundWebhookSecretStore`

#### Parameters

##### secrets?

readonly [`OutboundWebhookSecret`](/api/webhooks-core/src/type-aliases/outboundwebhooksecret/)[] = `[]`

#### Returns

`InMemoryOutboundWebhookSecretStore`

## Methods

### getSecret()

> **getSecret**(`tenantId`, `endpointId`, `version`): `Promise`\<[`OutboundWebhookSecret`](/api/webhooks-core/src/type-aliases/outboundwebhooksecret/) \| `undefined`\>

#### Parameters

##### tenantId

`string`

##### endpointId

`string`

##### version

`string`

#### Returns

`Promise`\<[`OutboundWebhookSecret`](/api/webhooks-core/src/type-aliases/outboundwebhooksecret/) \| `undefined`\>

#### Implementation of

`OutboundWebhookSecretStore.getSecret`

***

### set()

> **set**(`secret`): `void`

#### Parameters

##### secret

[`OutboundWebhookSecret`](/api/webhooks-core/src/type-aliases/outboundwebhooksecret/)

#### Returns

`void`
