---
editUrl: false
next: false
prev: false
title: "MetricDefinition"
---

> **MetricDefinition**\<`C`\> = `object`

## Type Parameters

### C

`C` _extends_ `Readonly`\<`Record`\<`string`, [`MetricColumn`](/api/metrics-core/src/type-aliases/metriccolumn/)\>\> = `Readonly`\<`Record`\<`string`, [`MetricColumn`](/api/metrics-core/src/type-aliases/metriccolumn/)\>\>

## Properties

### bucket?

> `readonly` `optional` **bucket?**: `object`

#### granularity

> `readonly` **granularity**: `"day"` \| `"month"`

#### zone

> `readonly` **zone**: `string`

---

### filter?

> `readonly` `optional` **filter?**: [`MetricFilter`](/api/metrics-core/src/type-aliases/metricfilter/)

---

### from

> `readonly` **from**: [`MetricFact`](/api/metrics-core/src/type-aliases/metricfact/)\<`C`\>

---

### groupByRequired

> `readonly` **groupByRequired**: readonly [`MetricColumnRef`](/api/metrics-core/src/type-aliases/metriccolumnref/)[]

---

### id

> `readonly` **id**: `string`

---

### measure

> `readonly` **measure**: [`MetricExpression`](/api/metrics-core/src/type-aliases/metricexpression/)

---

### population

> `readonly` **population**: `string`

---

### sourceRefs

> `readonly` **sourceRefs**: readonly `string`[]

---

### time

> `readonly` **time**: [`MetricColumnRef`](/api/metrics-core/src/type-aliases/metriccolumnref/)

---

### unit

> `readonly` **unit**: `string`

---

### version

> `readonly` **version**: `number`
