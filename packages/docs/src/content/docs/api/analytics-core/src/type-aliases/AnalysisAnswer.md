---
editUrl: false
next: false
prev: false
title: "AnalysisAnswer"
---

> **AnalysisAnswer** = `object`

## Properties

### availability

> `readonly` **availability**: `"ready"` \| `"missing"`

---

### denominator?

> `readonly` `optional` **denominator?**: `string`

---

### facts

> `readonly` **facts**: readonly [`AnalysisFact`](/api/analytics-core/src/type-aliases/analysisfact/)[]

---

### limitations

> `readonly` **limitations**: readonly `string`[]

---

### metricDefinition

> `readonly` **metricDefinition**: [`MetricDefinitionIdentity`](/api/metrics-core/src/type-aliases/metricdefinitionidentity/)

---

### numerator?

> `readonly` `optional` **numerator?**: `string`

---

### population

> `readonly` **population**: `string`

---

### snapshotRefs

> `readonly` **snapshotRefs**: readonly `string`[]

---

### source

> `readonly` **source**: `"report"` \| `"executor"`

---

### sourceRefs

> `readonly` **sourceRefs**: readonly `string`[]

---

### window

> `readonly` **window**: [`MetricWindow`](/api/metrics-core/src/type-aliases/metricwindow/)
