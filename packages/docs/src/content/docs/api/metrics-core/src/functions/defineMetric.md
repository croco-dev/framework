---
editUrl: false
next: false
prev: false
title: "defineMetric"
---

> **defineMetric**\<`C`\>(`id`, `options`): [`MetricDefinition`](/api/metrics-core/src/type-aliases/metricdefinition/)\<`C`\>

## Type Parameters

### C

`C` _extends_ `Readonly`\<`Record`\<`string`, [`MetricColumn`](/api/metrics-core/src/type-aliases/metriccolumn/)\>\>

## Parameters

### id

`string`

### options

#### bucket?

\{ `granularity`: `"day"` \| `"month"`; `zone`: `string`; \}

#### bucket.granularity

`"day"` \| `"month"`

#### bucket.zone

`string`

#### filter?

[`MetricFilter`](/api/metrics-core/src/type-aliases/metricfilter/)

#### from

[`MetricFact`](/api/metrics-core/src/type-aliases/metricfact/)\<`C`\>

#### groupByRequired?

readonly [`MetricColumnRef`](/api/metrics-core/src/type-aliases/metriccolumnref/)\<[`MetricColumn`](/api/metrics-core/src/type-aliases/metriccolumn/)\>[]

#### measure

[`MetricExpression`](/api/metrics-core/src/type-aliases/metricexpression/)

#### population

`string`

#### time

[`MetricColumnRef`](/api/metrics-core/src/type-aliases/metriccolumnref/)

#### unit

`string`

#### version

`number`

## Returns

[`MetricDefinition`](/api/metrics-core/src/type-aliases/metricdefinition/)\<`C`\>
