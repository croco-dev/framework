---
editUrl: false
next: false
prev: false
title: "backtestGrowthModel"
---

> **backtestGrowthModel**(`model`, `data`, `options`, `bounds?`): [`GrowthBacktest`](/api/metrics-core/src/type-aliases/growthbacktest/)

## Parameters

### model

[`GrowthModel`](/api/metrics-core/src/type-aliases/growthmodel/)

### data

[`GrowthDataset`](/api/metrics-core/src/type-aliases/growthdataset/)

### options

#### errorMetric

`"MAE"` \| `"MAPE"`

#### inflows

\{ `label`: `"assumption"`; `rationale`: `string`; `unit`: `string`; `values`: readonly readonly `number`[][]; \}

#### inflows.label

`"assumption"`

#### inflows.rationale

`string`

#### inflows.unit

`string`

#### inflows.values

readonly readonly `number`[][]

#### testWindow

\{ `from`: `number`; `to`: `number`; \}

#### testWindow.from

`number`

#### testWindow.to

`number`

#### trainEnd

`number`

### bounds?

[`GrowthLimits`](/api/metrics-core/src/type-aliases/growthlimits/) = `DEFAULT_GROWTH_LIMITS`

## Returns

[`GrowthBacktest`](/api/metrics-core/src/type-aliases/growthbacktest/)
