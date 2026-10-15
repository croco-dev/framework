---
editUrl: false
next: false
prev: false
title: "collectGrowthHistory"
---

> **collectGrowthHistory**(`source`, `model`, `metadata`, `binding`, `bounds?`, `signal?`): `Promise`\<[`GrowthDataset`](/api/metrics-core/src/type-aliases/growthdataset/)\>

A declared complete subject partition requires explicit exit states; missing subjects are unknown, never dropped.

## Parameters

### source

`AsyncIterable`\<`Readonly`\<`Record`\<`string`, `unknown`\>\>\>

### model

[`GrowthModel`](/api/metrics-core/src/type-aliases/growthmodel/)

### metadata

[`GrowthHistoryMetadata`](/api/metrics-core/src/type-aliases/growthhistorymetadata/)

### binding

[`GrowthHistoryBinding`](/api/metrics-core/src/type-aliases/growthhistorybinding/)

### bounds?

[`GrowthLimits`](/api/metrics-core/src/type-aliases/growthlimits/) = `DEFAULT_GROWTH_LIMITS`

### signal?

`AbortSignal`

## Returns

`Promise`\<[`GrowthDataset`](/api/metrics-core/src/type-aliases/growthdataset/)\>
