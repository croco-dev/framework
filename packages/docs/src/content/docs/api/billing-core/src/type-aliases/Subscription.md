---
editUrl: false
next: false
prev: false
title: "Subscription"
---

> **Subscription** = `object`

billing account, invoice, order, plan, subscription 도메인 타입입니다.

## Properties

### billingAccountId

> **billingAccountId**: `string`

---

### cancelAtPeriodEnd

> **cancelAtPeriodEnd**: `boolean`

---

### currentPeriodEnd

> **currentPeriodEnd**: `Date`

---

### externalSubscriptionId

> **externalSubscriptionId**: `string`

---

### id

> **id**: `string`

---

### lastSyncedAt

> **lastSyncedAt**: `Date`

---

### planId

> `readonly` **planId**: `string`

---

### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

---

### status

> **status**: [`SubscriptionStatus`](/api/billing-core/src/type-aliases/subscriptionstatus/)
