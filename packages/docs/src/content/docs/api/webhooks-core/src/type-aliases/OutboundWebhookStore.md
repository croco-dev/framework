---
editUrl: false
next: false
prev: false
title: "OutboundWebhookStore"
---

> **OutboundWebhookStore** = `object`

## Methods

### claimDelivery()

> **claimDelivery**(`tenantId`, `deliveryId`, `eligibleAt`): `Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/) \| `undefined`\>

#### Parameters

##### tenantId

`string`

##### deliveryId

`string`

##### eligibleAt

`Date`

#### Returns

`Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/) \| `undefined`\>

---

### commitEvent()

> **commitEvent**(`input`): `Promise`\<[`OutboundWebhookCommitResult`](/api/webhooks-core/src/type-aliases/outboundwebhookcommitresult/)\>

#### Parameters

##### input

###### endpoints

readonly [`OutboundWebhookEndpoint`](/api/webhooks-core/src/type-aliases/outboundwebhookendpoint/)[]

###### event

[`OutboundWebhookEvent`](/api/webhooks-core/src/type-aliases/outboundwebhookevent/)

#### Returns

`Promise`\<[`OutboundWebhookCommitResult`](/api/webhooks-core/src/type-aliases/outboundwebhookcommitresult/)\>

---

### createReplay()

> **createReplay**(`input`): `Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)\>

#### Parameters

##### input

###### createdAt

`Date`

###### deliveryId

`string`

###### replayId

`string`

###### tenantId

`string`

#### Returns

`Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)\>

---

### getDelivery()

> **getDelivery**(`tenantId`, `deliveryId`): `Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/) \| `undefined`\>

#### Parameters

##### tenantId

`string`

##### deliveryId

`string`

#### Returns

`Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/) \| `undefined`\>

---

### getEvent()

> **getEvent**(`tenantId`, `eventId`): `Promise`\<[`OutboundWebhookEvent`](/api/webhooks-core/src/type-aliases/outboundwebhookevent/) \| `undefined`\>

#### Parameters

##### tenantId

`string`

##### eventId

`string`

#### Returns

`Promise`\<[`OutboundWebhookEvent`](/api/webhooks-core/src/type-aliases/outboundwebhookevent/) \| `undefined`\>

---

### listAttempts()

> **listAttempts**(`tenantId`, `deliveryId`): `Promise`\<readonly [`OutboundWebhookAttempt`](/api/webhooks-core/src/type-aliases/outboundwebhookattempt/)[]\>

#### Parameters

##### tenantId

`string`

##### deliveryId

`string`

#### Returns

`Promise`\<readonly [`OutboundWebhookAttempt`](/api/webhooks-core/src/type-aliases/outboundwebhookattempt/)[]\>

---

### listDeliveries()

> **listDeliveries**(`tenantId`, `eventId`): `Promise`\<readonly [`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)[]\>

#### Parameters

##### tenantId

`string`

##### eventId

`string`

#### Returns

`Promise`\<readonly [`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)[]\>

---

### listUnpublishedIntents()

> **listUnpublishedIntents**(`tenantId`): `Promise`\<readonly [`OutboundWebhookDispatchIntent`](/api/webhooks-core/src/type-aliases/outboundwebhookdispatchintent/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<readonly [`OutboundWebhookDispatchIntent`](/api/webhooks-core/src/type-aliases/outboundwebhookdispatchintent/)[]\>

---

### markIntentPublished()

> **markIntentPublished**(`tenantId`, `intentId`, `publishedAt`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### intentId

`string`

##### publishedAt

`Date`

#### Returns

`Promise`\<`void`\>

---

### recordAttempt()

> **recordAttempt**(`input`): `Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)\>

#### Parameters

##### input

###### attempt

[`OutboundWebhookAttempt`](/api/webhooks-core/src/type-aliases/outboundwebhookattempt/)

###### nextAttemptAt?

`Date`

###### status

[`OutboundWebhookDeliveryStatus`](/api/webhooks-core/src/type-aliases/outboundwebhookdeliverystatus/)

###### tenantId

`string`

#### Returns

`Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)\>

---

### releaseDeliveryClaim()

> **releaseDeliveryClaim**(`tenantId`, `deliveryId`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### deliveryId

`string`

#### Returns

`Promise`\<`void`\>

---

### scheduleDelivery()

> **scheduleDelivery**(`input`): `Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)\>

#### Parameters

##### input

###### deliveryId

`string`

###### scheduledAt

`Date`

###### tenantId

`string`

#### Returns

`Promise`\<[`OutboundWebhookDelivery`](/api/webhooks-core/src/type-aliases/outboundwebhookdelivery/)\>
