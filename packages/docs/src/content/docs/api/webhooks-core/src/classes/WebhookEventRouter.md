---
editUrl: false
next: false
prev: false
title: "WebhookEventRouter"
---

## Type Parameters

### TEvents

`TEvents` _extends_ [`WebhookEventCatalog`](/api/webhooks-core/src/type-aliases/webhookeventcatalog/) = [`WebhookEventCatalog`](/api/webhooks-core/src/type-aliases/webhookeventcatalog/)

## Constructors

### Constructor

> **new WebhookEventRouter**\<`TEvents`\>(): `WebhookEventRouter`\<`TEvents`\>

#### Returns

`WebhookEventRouter`\<`TEvents`\>

## Methods

### dispatch()

> **dispatch**\<`TType`\>(`event`, `context`): `Promise`\<`EventResult`\<`TEvents`, `TType`\>\>

#### Type Parameters

##### TType

`TType` _extends_ `string`

#### Parameters

##### event

[`WebhookEvent`](/api/webhooks-core/src/type-aliases/webhookevent/)\<`EventPayload`\<`TEvents`, `TType`\>, `TType`\>

##### context

[`WebhookDispatchContext`](/api/webhooks-core/src/type-aliases/webhookdispatchcontext/)

#### Returns

`Promise`\<`EventResult`\<`TEvents`, `TType`\>\>

---

### has()

> **has**(`eventType`): `boolean`

#### Parameters

##### eventType

`string`

#### Returns

`boolean`

---

### register()

> **register**\<`TType`\>(`eventType`, `handler`): `this`

#### Type Parameters

##### TType

`TType` _extends_ `string`

#### Parameters

##### eventType

`TType`

##### handler

[`WebhookEventHandler`](/api/webhooks-core/src/type-aliases/webhookeventhandler/)\<[`WebhookEvent`](/api/webhooks-core/src/type-aliases/webhookevent/)\<`EventPayload`\<`TEvents`, `TType`\>, `TType`\>, `EventResult`\<`TEvents`, `TType`\>\>

#### Returns

`this`
