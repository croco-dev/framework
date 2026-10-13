---
editUrl: false
next: false
prev: false
title: "importGrowthHistory"
---

> **importGrowthHistory**(`bytes`, `schema`, `model`, `metadata`, `binding`, `bounds?`, `signal?`): `Promise`\<[`GrowthDataset`](/api/metrics-core/src/type-aliases/growthdataset/)\>

Shared ETL decoder owns CSV/JSONL parsing. Numeric period schema must be explicit.

## Parameters

### bytes

`AsyncIterable`\<`Uint8Array`\<`ArrayBufferLike`\>\>

### schema

`SourceSchema`

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
