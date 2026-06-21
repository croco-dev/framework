---
editUrl: false
next: false
prev: false
title: "WebhookGatewayIgnoredResult"
---

> **WebhookGatewayIgnoredResult** = `object`

## Properties

### event

> `readonly` **event**: [`WebhookEvent`](/api/webhooks-core/src/type-aliases/webhookevent/)

***

### idempotencyKey

> `readonly` **idempotencyKey**: [`DerivedIdempotencyKey`](/api/idempotency-core/src/type-aliases/derivedidempotencykey/)

***

### outcome

> `readonly` **outcome**: `"ignored"` \| `"reported"`

***

### problem

> `readonly` **problem**: [`Problem`](/api/problems-core/src/classes/problem/)
