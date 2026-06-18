---
editUrl: false
next: false
prev: false
title: "PlanRegistry"
---

Registry interface for managing billing plans.
Implementations: InMemoryPlanRegistry, DrizzlePlanRegistry

## Methods

### getAllPlans()

> **getAllPlans**(): `Promise`\<[`Plan`](/api/billing-core/src/type-aliases/plan/)[]\>

Get all available plans.

#### Returns

`Promise`\<[`Plan`](/api/billing-core/src/type-aliases/plan/)[]\>

Array of all plans

***

### getPlan()

> **getPlan**(`planId`): `Promise`\<[`Plan`](/api/billing-core/src/type-aliases/plan/) \| `null`\>

Get a plan by ID.

#### Parameters

##### planId

`string`

The plan identifier

#### Returns

`Promise`\<[`Plan`](/api/billing-core/src/type-aliases/plan/) \| `null`\>

The plan or null if not found

***

### getPlanAtDate()

> **getPlanAtDate**(`planId`, `date`): `Promise`\<[`Plan`](/api/billing-core/src/type-aliases/plan/) \| `null`\>

Get a plan as it was configured at a specific point in time.
Useful for handling historical pricing (e.g., legacy subscriptions).

#### Parameters

##### planId

`string`

The plan identifier

##### date

`Date`

The date to query historical pricing for

#### Returns

`Promise`\<[`Plan`](/api/billing-core/src/type-aliases/plan/) \| `null`\>

The plan at the given date or null if not found
