---
editUrl: false
next: false
prev: false
title: "BetterAuthWebhookOptions"
---

> **BetterAuthWebhookOptions** = `object`

Better Auth 웹훅 검증 옵션입니다.

## Properties

### idempotencyStore

> **idempotencyStore**: [`LeaseAwareIdempotencyStore`](/api/idempotency-core/src/type-aliases/leaseawareidempotencystore/)\<[`WebhookGatewayStoredResult`](/api/webhooks-core/src/type-aliases/webhookgatewaystoredresult/)\>

---

### processingLeaseMs?

> `optional` **processingLeaseMs?**: `number`

Processing lease in milliseconds; defaults to 15 minutes. Set above the maximum handler duration.

---

### signingSecret

> **signingSecret**: `string`
