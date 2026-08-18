---
editUrl: false
next: false
prev: false
title: "WebhookUnknownEventReporter"
---

> **WebhookUnknownEventReporter**\<`TEvent`\> = `object`

## Type Parameters

### TEvent

`TEvent` _extends_ [`WebhookEvent`](/api/webhooks-core/src/type-aliases/webhookevent/) = [`WebhookEvent`](/api/webhooks-core/src/type-aliases/webhookevent/)

## Methods

### reportUnknownEvent()

> **reportUnknownEvent**(`options`): `void` \| `Promise`\<`void`\>

#### Parameters

##### options

###### context

`Omit`\<[`WebhookDispatchContext`](/api/webhooks-core/src/type-aliases/webhookdispatchcontext/), `"idempotencyKey"`\>

###### event

`TEvent`

###### problem

[`Problem`](/api/problems-core/src/classes/problem/)

#### Returns

`void` \| `Promise`\<`void`\>
