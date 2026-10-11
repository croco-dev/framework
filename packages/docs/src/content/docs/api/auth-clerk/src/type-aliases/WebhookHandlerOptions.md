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

> `readonly` **idempotencyStore**: [`LeaseAwareIdempotencyStore`](/api/idempotency-core/src/type-aliases/leaseawareidempotencystore/)\<[`ClerkWebhookDeliveryOutcome`](/api/auth-clerk/src/type-aliases/clerkwebhookdeliveryoutcome/)\>

---

### idempotencyTtlMs?

> `readonly` `optional` **idempotencyTtlMs?**: `number`

---

### processingLeaseMs?

> `readonly` `optional` **processingLeaseMs?**: `number`

---

### signingSecret

> `readonly` **signingSecret**: `string`
