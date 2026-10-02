---
editUrl: false
next: false
prev: false
title: "ExperimentEvaluationProvider"
---

## Methods

### evaluateDetailed()

> **evaluateDetailed**(`input`): `Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\<`string` \| `number` \| `boolean`\>\>

#### Parameters

##### input

[`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/) & `object`

#### Returns

`Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\<`string` \| `number` \| `boolean`\>\>

---

### previewDetailed()?

> `optional` **previewDetailed**(`input`): `Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\<`string` \| `number` \| `boolean`\>\>

Evaluate without assignment, exposure, analytics events, or other persistent side effects.

#### Parameters

##### input

[`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/) & `object`

#### Returns

`Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\<`string` \| `number` \| `boolean`\>\>
