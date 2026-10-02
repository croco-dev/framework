---
editUrl: false
next: false
prev: false
title: "ExperimentRegistration"
---

> **ExperimentRegistration** = `object`

## Properties

### definition

> `readonly` **definition**: [`ExperimentDefinition`](/api/features-core/src/type-aliases/experimentdefinition/)

---

### eligibility

> `readonly` **eligibility**: (`input`, `now`) => [`ExperimentEligibility`](/api/features-core/src/type-aliases/experimenteligibility/) \| `Promise`\<[`ExperimentEligibility`](/api/features-core/src/type-aliases/experimenteligibility/)\>

Inject an adapter using the published audience reader here; never fetch source systems during serving.

#### Parameters

##### input

[`ExperimentInput`](/api/features-core/src/type-aliases/experimentinput/)

##### now

`string`

#### Returns

[`ExperimentEligibility`](/api/features-core/src/type-aliases/experimenteligibility/) \| `Promise`\<[`ExperimentEligibility`](/api/features-core/src/type-aliases/experimenteligibility/)\>

---

### handlers

> `readonly` **handlers**: `Readonly`\<`Record`\<`string`, (`context`) => `unknown` \| `Promise`\<`unknown`\>\>\>

---

### provider?

> `readonly` `optional` **provider?**: [`ExperimentEvaluationProvider`](/api/features-core/src/interfaces/experimentevaluationprovider/)
