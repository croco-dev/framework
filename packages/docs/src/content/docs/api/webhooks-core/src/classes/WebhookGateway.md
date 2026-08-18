---
editUrl: false
next: false
prev: false
title: "WebhookGateway"
---

## Constructors

### Constructor

> **new WebhookGateway**(`options`): `WebhookGateway`

#### Parameters

##### options

[`WebhookGatewayOptions`](/api/webhooks-core/src/type-aliases/webhookgatewayoptions/)

#### Returns

`WebhookGateway`

## Methods

### handle()

> **handle**(`request`): `Promise`\<[`WebhookGatewayResult`](/api/webhooks-core/src/type-aliases/webhookgatewayresult/)\>

#### Parameters

##### request

[`WebhookGatewayRequest`](/api/webhooks-core/src/type-aliases/webhookgatewayrequest/)

#### Returns

`Promise`\<[`WebhookGatewayResult`](/api/webhooks-core/src/type-aliases/webhookgatewayresult/)\>

***

### replay()

> **replay**(`fixture`): `Promise`\<[`WebhookGatewayResult`](/api/webhooks-core/src/type-aliases/webhookgatewayresult/)\>

#### Parameters

##### fixture

[`WebhookGatewayReplayFixture`](/api/webhooks-core/src/type-aliases/webhookgatewayreplayfixture/)

#### Returns

`Promise`\<[`WebhookGatewayResult`](/api/webhooks-core/src/type-aliases/webhookgatewayresult/)\>
