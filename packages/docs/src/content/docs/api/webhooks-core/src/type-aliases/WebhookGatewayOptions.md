---
editUrl: false
next: false
prev: false
title: "WebhookGatewayOptions"
---

> **WebhookGatewayOptions** = `object`

## Properties

### adapter

> `readonly` **adapter**: [`WebhookProviderAdapter`](/api/webhooks-core/src/type-aliases/webhookprovideradapter/)

***

### idempotencyNamespace?

> `readonly` `optional` **idempotencyNamespace?**: `string`

***

### idempotencyStore

> `readonly` **idempotencyStore**: [`IdempotencyStore`](/api/idempotency-core/src/type-aliases/idempotencystore/)\<[`WebhookGatewayStoredResult`](/api/webhooks-core/src/type-aliases/webhookgatewaystoredresult/)\>

***

### idempotencyTtlMs?

> `readonly` `optional` **idempotencyTtlMs?**: `number`

***

### now?

> `readonly` `optional` **now?**: () => `Date`

#### Returns

`Date`

***

### router

> `readonly` **router**: `object`

#### dispatch()

> **dispatch**(`event`, `context`): `Promise`\<`unknown`\>

##### Parameters

###### event

[`WebhookEvent`](/api/webhooks-core/src/type-aliases/webhookevent/)

###### context

[`WebhookDispatchContext`](/api/webhooks-core/src/type-aliases/webhookdispatchcontext/)

##### Returns

`Promise`\<`unknown`\>

#### has()

> **has**(`eventType`): `boolean`

##### Parameters

###### eventType

`string`

##### Returns

`boolean`

***

### unknownEventPolicy

> `readonly` **unknownEventPolicy**: [`UnknownEventPolicy`](/api/webhooks-core/src/type-aliases/unknowneventpolicy/)

***

### unknownEventReporter?

> `readonly` `optional` **unknownEventReporter?**: [`WebhookUnknownEventReporter`](/api/webhooks-core/src/type-aliases/webhookunknowneventreporter/)
