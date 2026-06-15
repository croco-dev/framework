---
editUrl: false
next: false
prev: false
title: "MrrCalculator"
---

Calculator for Monthly Recurring Revenue (MRR).

MRR measures the predictable monthly revenue generated from subscriptions.
Annual plans are normalized to monthly equivalents (amount / 12).

## Constructors

### Constructor

> **new MrrCalculator**(): `MrrCalculator`

#### Returns

`MrrCalculator`

## Methods

### calculateMRR()

> **calculateMRR**(`subscriptions`, `planProvider`): `Promise`\<[`Money`](/api/metrics-core/src/type-aliases/money/)\>

Calculate total MRR from active subscriptions.

#### Parameters

##### subscriptions

[`SubscriptionSnapshot`](/api/metrics-core/src/type-aliases/subscriptionsnapshot/)[]

Active subscriptions to calculate MRR from

##### planProvider

[`PlanProvider`](/api/metrics-core/src/interfaces/planprovider/)

#### Returns

`Promise`\<[`Money`](/api/metrics-core/src/type-aliases/money/)\>

Total MRR as Money value

***

### classifyMRRMovement()

> **classifyMRRMovement**(`hasPreviousSubscription`, `wasChurned`, `previousAmount`, `newAmount`): `"new"` \| `"expansion"` \| `"contraction"` \| `"churned"` \| `"reactivation"` \| `"unchanged"`

Classify MRR movement type based on event and subscription history.

#### Parameters

##### hasPreviousSubscription

`boolean`

Whether customer had a subscription before

##### wasChurned

`boolean`

Whether previous subscription was churned

##### previousAmount

`number`

Previous plan amount (if any)

##### newAmount

`number`

New plan amount

#### Returns

`"new"` \| `"expansion"` \| `"contraction"` \| `"churned"` \| `"reactivation"` \| `"unchanged"`

MRR movement type

***

### normalizeMRR()

> **normalizeMRR**(`amount`, `interval`, `intervalCount`): `number`

Normalize plan amount to monthly equivalent.

#### Parameters

##### amount

`number`

Plan amount in minor units

##### interval

Plan interval (month or year)

`"month"` | `"year"`

##### intervalCount

`number`

Number of intervals per billing cycle

#### Returns

`number`

Normalized monthly MRR amount
