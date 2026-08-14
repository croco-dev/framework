---
editUrl: false
next: false
prev: false
title: "BillingSubscriptionWebhookTransition"
---

> **BillingSubscriptionWebhookTransition** = `object`

## Properties

### eventId

> `readonly` **eventId**: `string`

---

### eventType

> `readonly` **eventType**: `string`

---

### intents

> `readonly` **intents**: readonly [`BillingWebhookEventIntent`](/api/billing-core/src/type-aliases/billingwebhookeventintent/)[]

---

### previousSubscription

> `readonly` **previousSubscription**: [`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`

---

### state

> `readonly` **state**: `"pending"` \| `"completed"`

---

### subscription

> `readonly` **subscription**: [`Subscription`](/api/billing-core/src/type-aliases/subscription/)
