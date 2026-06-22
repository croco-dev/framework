---
editUrl: false
next: false
prev: false
title: "WebhookDispatchContext"
---

> **WebhookDispatchContext** = `object`

## Properties

### eventId

> `readonly` **eventId**: `string`

---

### eventType

> `readonly` **eventType**: `string`

---

### headers

> `readonly` **headers**: [`NormalizedWebhookHeaders`](/api/webhooks-core/src/type-aliases/normalizedwebhookheaders/)

---

### idempotencyKey

> `readonly` **idempotencyKey**: [`DerivedIdempotencyKey`](/api/idempotency-core/src/type-aliases/derivedidempotencykey/)

---

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `unknown`\>

---

### provider

> `readonly` **provider**: `string`

---

### rawBody

> `readonly` **rawBody**: [`WebhookRawBody`](/api/webhooks-core/src/type-aliases/webhookrawbody/)

---

### receivedAt

> `readonly` **receivedAt**: `Date`

---

### replay

> `readonly` **replay**: `boolean`
