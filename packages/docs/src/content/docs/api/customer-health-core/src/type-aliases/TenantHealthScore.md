---
editUrl: false
next: false
prev: false
title: "TenantHealthScore"
---

> **TenantHealthScore** = `object`

## Properties

### calculatedAt

> **calculatedAt**: `Date`

---

### categoryScores

> **categoryScores**: `Record`\<[`SignalCategory`](/api/customer-health-core/src/type-aliases/signalcategory/), `number`\>

---

### overallScore

> **overallScore**: `number`

---

### previousScore?

> `optional` **previousScore?**: `number`

---

### signals

> **signals**: [`HealthSignal`](/api/customer-health-core/src/type-aliases/healthsignal/)[]

---

### status

> **status**: [`HealthStatus`](/api/customer-health-core/src/type-aliases/healthstatus/)

---

### tenantId

> **tenantId**: `string`

---

### transitionVersion?

> `optional` **transitionVersion?**: `string`

---

### trend

> **trend**: [`HealthTrend`](/api/customer-health-core/src/type-aliases/healthtrend/)
