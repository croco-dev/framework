---
editUrl: false
next: false
prev: false
title: "MetricExpression"
---

> **MetricExpression** = [`AggregateExpression`](/api/metrics-core/src/type-aliases/aggregateexpression/) \| \{ `denominator`: `Extract`\<[`AggregateExpression`](/api/metrics-core/src/type-aliases/aggregateexpression/), \{ `kind`: `"count"`; \}\>; `kind`: `"average"`; `numerator`: `Extract`\<[`AggregateExpression`](/api/metrics-core/src/type-aliases/aggregateexpression/), \{ `kind`: `"sum"` \| `"min"` \| `"max"`; \}\>; \} \| \{ `denominator`: [`AggregateExpression`](/api/metrics-core/src/type-aliases/aggregateexpression/); `kind`: `"ratio"`; `numerator`: [`AggregateExpression`](/api/metrics-core/src/type-aliases/aggregateexpression/); `zeroDenominator`: `"null"`; \}
