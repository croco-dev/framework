---
editUrl: false
next: false
prev: false
title: "BillingLifecycleEventPublisher"
---

Publishes billing lifecycle events with durable event-ID deduplication.

Implementations must treat repeated calls with the same `event.eventId` as one logical delivery,
including retries after an ambiguous result where the first call may already have produced the
side effect.

## Methods

### publishIdempotently()

> **publishIdempotently**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

[`SubscriptionCanceledEvent`](/api/billing-core/src/classes/subscriptioncanceledevent/)

#### Returns

`Promise`\<`void`\>
