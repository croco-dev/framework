---
editUrl: false
next: false
prev: false
title: "WebhookHandlerOptions"
---

> **WebhookHandlerOptions** = `object`

Clerk 웹훅과 인증 요청에 필요한 공개 타입입니다.

## Properties

### idempotencyStore

> `readonly` **idempotencyStore**: [`IdempotencyStore`](/api/idempotency-core/src/type-aliases/idempotencystore/)\<[`ClerkWebhookDeliveryOutcome`](/api/auth-clerk/src/type-aliases/clerkwebhookdeliveryoutcome/)\>

---

### idempotencyTtlMs?

> `readonly` `optional` **idempotencyTtlMs?**: `number`

---

### signingSecret

> `readonly` **signingSecret**: `string`
