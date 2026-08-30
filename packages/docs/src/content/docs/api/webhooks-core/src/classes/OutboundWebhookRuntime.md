---
editUrl: false
next: false
prev: false
title: "OutboundWebhookRuntime"
---

## Constructors

### Constructor

> **new OutboundWebhookRuntime**(`options`): `OutboundWebhookRuntime`

#### Parameters

##### options

[`OutboundWebhookRuntimeOptions`](/api/webhooks-core/src/type-aliases/outboundwebhookruntimeoptions/)

#### Returns

`OutboundWebhookRuntime`

## Methods

### diagnostics()

> **diagnostics**(`tenantId`, `eventId`): `Promise`\<[`OutboundWebhookDiagnostics`](/api/webhooks-core/src/type-aliases/outboundwebhookdiagnostics/)\>

#### Parameters

##### tenantId

`string`

##### eventId

`string`

#### Returns

`Promise`\<[`OutboundWebhookDiagnostics`](/api/webhooks-core/src/type-aliases/outboundwebhookdiagnostics/)\>

---

### dispatch()

> **dispatch**(`tenantId`, `deliveryId`, `signal?`): `Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)\>

#### Parameters

##### tenantId

`string`

##### deliveryId

`string`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)\>

---

### publish()

> **publish**\<`TPayload`\>(`descriptor`): `Promise`\<[`OutboundWebhookCommitResult`](/api/webhooks-core/src/type-aliases/outboundwebhookcommitresult/)\>

#### Type Parameters

##### TPayload

`TPayload`

#### Parameters

##### descriptor

[`OutboundWebhookEventDescriptor`](/api/webhooks-core/src/type-aliases/outboundwebhookeventdescriptor/)\<`TPayload`\>

#### Returns

`Promise`\<[`OutboundWebhookCommitResult`](/api/webhooks-core/src/type-aliases/outboundwebhookcommitresult/)\>

---

### publishUnpublishedIntents()

> **publishUnpublishedIntents**(`tenantId`): `Promise`\<[`OutboundWebhookIntentPublicationOutcome`](/api/webhooks-core/src/type-aliases/outboundwebhookintentpublicationoutcome/)\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`OutboundWebhookIntentPublicationOutcome`](/api/webhooks-core/src/type-aliases/outboundwebhookintentpublicationoutcome/)\>

---

### replay()

> **replay**(`tenantId`, `deliveryId`, `replayId?`): `Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)\>

#### Parameters

##### tenantId

`string`

##### deliveryId

`string`

##### replayId?

`string` = `...`

#### Returns

`Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)\>

---

### resume()

> **resume**(`tenantId`, `deliveryId`): `Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)\>

#### Parameters

##### tenantId

`string`

##### deliveryId

`string`

#### Returns

`Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)\>
