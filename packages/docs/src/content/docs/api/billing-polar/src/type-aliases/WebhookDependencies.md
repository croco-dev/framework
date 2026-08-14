---
editUrl: false
next: false
prev: false
title: "WebhookDependencies"
---

> **WebhookDependencies** = `object`

Dependencies for Polar webhook handling, including an idempotent publication adapter.

## Properties

### eventPublisher

> **eventPublisher**: [`PolarWebhookEventPublisher`](/api/billing-polar/src/type-aliases/polarwebhookeventpublisher/)

Use an adapter when migrating from `EventPublisher`; the adapter must provide durable,
stable-identity deduplication for `publishIdempotently`.

---

### planRegistry

> **planRegistry**: [`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/)

---

### store

> **store**: [`BillingStore`](/api/billing-core/src/classes/billingstore/)
