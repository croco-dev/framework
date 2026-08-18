---
editUrl: false
next: false
prev: false
title: "SubscriptionQuantityReconcilerDependencies"
---

> **SubscriptionQuantityReconcilerDependencies** = `object`

## Properties

### clock?

> `readonly` `optional` **clock?**: () => `Date`

#### Returns

`Date`

---

### eventPublisher?

> `readonly` `optional` **eventPublisher?**: [`SubscriptionQuantityReconciliationEventPublisher`](/api/billing-core/src/type-aliases/subscriptionquantityreconciliationeventpublisher/)

---

### gateway

> `readonly` **gateway**: [`LicensedQuantityGateway`](/api/billing-core/src/interfaces/licensedquantitygateway/)

---

### maxAttempts?

> `readonly` `optional` **maxAttempts?**: `number`

---

### planRegistry

> `readonly` **planRegistry**: [`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/)

---

### repairSource?

> `readonly` `optional` **repairSource?**: [`SubscriptionQuantityRepairSource`](/api/billing-core/src/interfaces/subscriptionquantityrepairsource/)

---

### source

> `readonly` **source**: [`SubscriptionQuantitySource`](/api/billing-core/src/interfaces/subscriptionquantitysource/)

---

### store

> `readonly` **store**: [`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/)
