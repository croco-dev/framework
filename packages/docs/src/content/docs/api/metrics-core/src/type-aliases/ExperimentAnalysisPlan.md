---
editUrl: false
next: false
prev: false
title: "ExperimentAnalysisPlan"
---

> **ExperimentAnalysisPlan** = `object`

## Properties

### experimentId

> `readonly` **experimentId**: `string`

---

### method?

> `readonly` `optional` **method?**: `string`

---

### observedWindow

> `readonly` **observedWindow**: `object`

#### from

> `readonly` **from**: `string`

#### to

> `readonly` **to**: `string`

---

### outcomeKind

> `readonly` **outcomeKind**: [`ExperimentOutcomeKind`](/api/metrics-core/src/type-aliases/experimentoutcomekind/)

---

### preTreatmentAttributes

> `readonly` **preTreatmentAttributes**: readonly `string`[]

---

### primaryMetricId

> `readonly` **primaryMetricId**: `string`

---

### randomizationUnit

> `readonly` **randomizationUnit**: [`ExperimentRandomizationUnit`](/api/metrics-core/src/type-aliases/experimentrandomizationunit/)

---

### revision

> `readonly` **revision**: `string`

---

### srmWarningThreshold

> `readonly` **srmWarningThreshold**: `number`

---

### unit?

> `readonly` `optional` **unit?**: `string`

---

### variants

> `readonly` **variants**: readonly [`ExperimentVariantInput`](/api/metrics-core/src/type-aliases/experimentvariantinput/)[]
