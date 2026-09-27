---
editUrl: false
next: false
prev: false
title: "MetricFact"
---

> **MetricFact**\<`C`\> = `object`

## Type Parameters

### C

`C` _extends_ `Readonly`\<`Record`\<`string`, [`MetricColumn`](/api/metrics-core/src/type-aliases/metriccolumn/)\>\> = `Readonly`\<`Record`\<`string`, [`MetricColumn`](/api/metrics-core/src/type-aliases/metriccolumn/)\>\>

## Properties

### aggregate?

> `readonly` `optional` **aggregate?**: `object`

#### measures

> `readonly` **measures**: `Readonly`\<`Partial`\<`Record`\<`string`, \{ `reaggregate`: `"sum"` \| `"none"`; `unit`: `string`; \}\>\>\>

---

### columns

> `readonly` **columns**: `C`

---

### kind

> `readonly` **kind**: `"transaction"` \| `"aggregate"`

---

### name

> `readonly` **name**: `string`

---

### sourceRefs?

> `readonly` `optional` **sourceRefs?**: readonly `string`[]
