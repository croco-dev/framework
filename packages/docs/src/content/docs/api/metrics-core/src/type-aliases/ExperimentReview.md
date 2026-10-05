---
editUrl: false
next: false
prev: false
title: "ExperimentReview"
---

> **ExperimentReview** = `object`

## Properties

### completeThrough

> `readonly` **completeThrough**: `string`

---

### conditional

> `readonly` **conditional**: `Readonly`\<`Record`\<`string`, [`ExperimentConditionalAggregate`](/api/metrics-core/src/type-aliases/experimentconditionalaggregate/)\>\>

---

### funnel

> `readonly` **funnel**: `Readonly`\<`Record`\<`string`, [`ExperimentFunnelCounts`](/api/metrics-core/src/type-aliases/experimentfunnelcounts/)\>\>

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

### plan

> `readonly` **plan**: [`ExperimentAnalysisPlan`](/api/metrics-core/src/type-aliases/experimentanalysisplan/)

---

### primary

> `readonly` **primary**: `Readonly`\<`Record`\<`string`, [`ExperimentVariantAggregate`](/api/metrics-core/src/type-aliases/experimentvariantaggregate/)\>\>

---

### provider?

> `readonly` `optional` **provider?**: [`ExperimentProviderSnapshot`](/api/metrics-core/src/type-aliases/experimentprovidersnapshot/)

---

### quality

> `readonly` **quality**: readonly [`QualityCheck`](/api/metrics-core/src/type-aliases/qualitycheck/)[]

---

### slices?

> `readonly` `optional` **slices?**: [`ExperimentSliceResult`](/api/metrics-core/src/type-aliases/experimentsliceresult/)

---

### srm

> `readonly` **srm**: [`ExperimentSrm`](/api/metrics-core/src/type-aliases/experimentsrm/)
