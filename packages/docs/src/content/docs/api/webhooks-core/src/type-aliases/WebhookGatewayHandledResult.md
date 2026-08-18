---
editUrl: false
next: false
prev: false
title: "WebhookGatewayHandledResult"
---

> **WebhookGatewayHandledResult** = `object`

## Properties

### dispatch

> `readonly` **dispatch**: [`WebhookDispatchResult`](/api/webhooks-core/src/type-aliases/webhookdispatchresult/)

***

### event

> `readonly` **event**: [`WebhookEvent`](/api/webhooks-core/src/type-aliases/webhookevent/)

***

### idempotencyKey

> `readonly` **idempotencyKey**: [`DerivedIdempotencyKey`](/api/idempotency-core/src/type-aliases/derivedidempotencykey/)

***

### outcome

> `readonly` **outcome**: `"handled"`

***

### record

> `readonly` **record**: [`IdempotencyCompletedRecord`](/api/idempotency-core/src/type-aliases/idempotencycompletedrecord/)\<[`WebhookGatewayStoredResult`](/api/webhooks-core/src/type-aliases/webhookgatewaystoredresult/)\>
