---
editUrl: false
next: false
prev: false
title: "AggregateExpression"
---

> **AggregateExpression** = \{ `column?`: [`MetricColumnRef`](/api/metrics-core/src/type-aliases/metriccolumnref/); `kind`: `"count"`; \} \| \{ `column`: [`MetricColumnRef`](/api/metrics-core/src/type-aliases/metriccolumnref/); `kind`: `"sum"` \| `"min"` \| `"max"`; `nulls?`: `"ignore"`; \} \| \{ `column`: [`MetricColumnRef`](/api/metrics-core/src/type-aliases/metriccolumnref/); `kind`: `"exact-distinct"`; \}
