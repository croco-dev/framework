---
editUrl: false
next: false
prev: false
title: "PlanProvider"
---

## Methods

### getPlanVersion()

> **getPlanVersion**(`pricingRef`): `Promise`\<[`PlanSnapshot`](/api/metrics-core/src/type-aliases/plansnapshot/) \| `null`\>

Resolve an immutable pricing reference, independent of the current time. Return null if unavailable.

#### Parameters

##### pricingRef

`string`

#### Returns

`Promise`\<[`PlanSnapshot`](/api/metrics-core/src/type-aliases/plansnapshot/) \| `null`\>
