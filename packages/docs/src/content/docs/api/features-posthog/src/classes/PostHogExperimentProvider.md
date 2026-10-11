---
editUrl: false
next: false
prev: false
title: "PostHogExperimentProvider"
---

The installed SDK exposes flag values but cannot attest detailed evaluation or flag revision.

## Implements

- [`ExperimentEvaluationProvider`](/api/features-core/src/interfaces/experimentevaluationprovider/)

## Constructors

### Constructor

> **new PostHogExperimentProvider**(`client`, `flag`): `PostHogExperimentProvider`

#### Parameters

##### client

[`PostHogClient`](/api/integrations-posthog/src/classes/posthogclient/)

##### flag

`string`

#### Returns

`PostHogExperimentProvider`

## Methods

### evaluateDetailed()

> **evaluateDetailed**(`input`): `Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\>

#### Parameters

##### input

[`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/) & `object`

#### Returns

`Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\>

#### Implementation of

[`ExperimentEvaluationProvider`](/api/features-core/src/interfaces/experimentevaluationprovider/).[`evaluateDetailed`](/api/features-core/src/interfaces/experimentevaluationprovider/#evaluatedetailed)

---

### previewDetailed()

> **previewDetailed**(`input`): `Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\>

Evaluate without assignment, exposure, analytics events, or other persistent side effects.

#### Parameters

##### input

[`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/) & `object`

#### Returns

`Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\>

#### Implementation of

[`ExperimentEvaluationProvider`](/api/features-core/src/interfaces/experimentevaluationprovider/).[`previewDetailed`](/api/features-core/src/interfaces/experimentevaluationprovider/#previewdetailed)
