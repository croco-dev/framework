---
editUrl: false
next: false
prev: false
title: "CommitBillingSubscriptionWebhookInput"
---

> **CommitBillingSubscriptionWebhookInput** = `object`

## Properties

### clearWebhookReservationId?

> `readonly` `optional` **clearWebhookReservationId?**: `string`

---

### createEventIntents

> `readonly` **createEventIntents**: (`previousSubscription`) => readonly [`SerializedEvent`](/api/events-core/src/interfaces/serializedevent/)[]

#### Parameters

##### previousSubscription

[`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`

#### Returns

readonly [`SerializedEvent`](/api/events-core/src/interfaces/serializedevent/)[]

---

### eventId

> `readonly` **eventId**: `string`

---

### eventType

> `readonly` **eventType**: `string`

---

### subscription

> `readonly` **subscription**: [`Subscription`](/api/billing-core/src/type-aliases/subscription/)
