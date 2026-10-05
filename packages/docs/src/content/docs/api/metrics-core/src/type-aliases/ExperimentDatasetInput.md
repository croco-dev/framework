---
editUrl: false
next: false
prev: false
title: "ExperimentDatasetInput"
---

> **ExperimentDatasetInput** = `object`

## Properties

### assignments

> `readonly` **assignments**: readonly [`ExperimentAssignment`](/api/metrics-core/src/type-aliases/experimentassignment/)[]

---

### completeThrough

> `readonly` **completeThrough**: `string`

---

### exposures

> `readonly` **exposures**: readonly [`ExperimentExposure`](/api/metrics-core/src/type-aliases/experimentexposure/)[]

---

### factsAvailableThrough?

> `readonly` `optional` **factsAvailableThrough?**: `string`

---

### outcomes

> `readonly` **outcomes**: readonly [`ExperimentOutcome`](/api/metrics-core/src/type-aliases/experimentoutcome/)[]

---

### plan

> `readonly` **plan**: [`ExperimentAnalysisPlan`](/api/metrics-core/src/type-aliases/experimentanalysisplan/)

---

### preTreatmentFacts

> `readonly` **preTreatmentFacts**: `Readonly`\<`Record`\<`string`, `Readonly`\<`Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\>\>\>\>

---

### providerError?

> `readonly` `optional` **providerError?**: `string`

---

### providerResults?

> `readonly` `optional` **providerResults?**: `Readonly`\<`Record`\<`string`, [`ExperimentProviderResultInput`](/api/metrics-core/src/type-aliases/experimentproviderresultinput/)\>\>

---

### treatmentReceived?

> `readonly` `optional` **treatmentReceived?**: readonly [`ExperimentTreatmentReceipt`](/api/metrics-core/src/type-aliases/experimenttreatmentreceipt/)[]
