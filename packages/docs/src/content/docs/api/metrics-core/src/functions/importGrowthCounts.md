---
editUrl: false
next: false
prev: false
title: "importGrowthCounts"
---

> **importGrowthCounts**(`model`, `input`, `bounds?`): [`GrowthDataset`](/api/metrics-core/src/type-aliases/growthdataset/)

Aggregate counts cannot prove mutually exclusive individual memberships.

## Parameters

### model

[`GrowthModel`](/api/metrics-core/src/type-aliases/growthmodel/)

### input

`Omit`\<[`GrowthDataset`](/api/metrics-core/src/type-aliases/growthdataset/), `"partitionValidation"` \| `"diagnostics"`\>

### bounds?

[`GrowthLimits`](/api/metrics-core/src/type-aliases/growthlimits/) = `DEFAULT_GROWTH_LIMITS`

## Returns

[`GrowthDataset`](/api/metrics-core/src/type-aliases/growthdataset/)
