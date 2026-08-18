---
editUrl: false
next: false
prev: false
title: "GrowthCalculator"
---

Calculator for business growth metrics.

Measures how fast a business is growing and its sustainability:

- Quick Ratio: (New MRR + Expansion MRR) / (Churned MRR + Contraction MRR)

## Constructors

### Constructor

> **new GrowthCalculator**(): `GrowthCalculator`

#### Returns

`GrowthCalculator`

## Methods

### calculateQuickRatio()

> **calculateQuickRatio**(`movement`): `Promise`\<`number` \| `null`\>

Calculate Quick Ratio for a period.

Quick Ratio measures how much new revenue is coming in compared to revenue leaving.

- > 4: Excellent growth
- 2-4: Healthy growth
- 1-2: Moderate growth
- <1: Declining (at risk)

#### Parameters

##### movement

[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)

MRR movement data for the period

#### Returns

`Promise`\<`number` \| `null`\>

Quick Ratio, or null if denominator is zero
