---
editUrl: false
next: false
prev: false
title: "BillingLifecycleSubscriptionResolution"
---

> **BillingLifecycleSubscriptionResolution** = \{ `kind`: `"projection_base"`; `subscription`: [`Subscription`](/api/billing-core/src/type-aliases/subscription/); \} \| \{ `kind`: `"current"`; `subscription`: [`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`; \}

Atomic read result for a pending lifecycle projection.

`projection_base` identifies the same external subscription and carries its latest snapshot.
`current` is authoritative when the command is stale, the subscription was replaced, or no
subscription exists.
