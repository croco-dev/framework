---
editUrl: false
next: false
prev: false
title: "estimateTransitionMatrix"
---

> **estimateTransitionMatrix**(`model`, `data`, `bounds?`): [`GrowthEstimate`](/api/metrics-core/src/type-aliases/growthestimate/)

Never fills an unobserved row with a self loop. The to index is the training population cutoff.

## Parameters

### model

[`GrowthModel`](/api/metrics-core/src/type-aliases/growthmodel/)

### data

[`GrowthDataset`](/api/metrics-core/src/type-aliases/growthdataset/)

### bounds?

[`GrowthLimits`](/api/metrics-core/src/type-aliases/growthlimits/) = `DEFAULT_GROWTH_LIMITS`

## Returns

[`GrowthEstimate`](/api/metrics-core/src/type-aliases/growthestimate/)
