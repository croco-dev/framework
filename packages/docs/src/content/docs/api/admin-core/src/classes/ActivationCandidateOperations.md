---
editUrl: false
next: false
prev: false
title: "ActivationCandidateOperations"
---

## Constructors

### Constructor

> **new ActivationCandidateOperations**(`options`): `ActivationCandidateOperations`

#### Parameters

##### options

[`ActivationCandidateOperationsOptions`](/api/admin-core/src/type-aliases/activationcandidateoperationsoptions/)

#### Returns

`ActivationCandidateOperations`

## Methods

### export()

> **export**(`id`, `signal?`): `Promise`\<`string`\>

#### Parameters

##### id

`string`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`string`\>

---

### load()

> **load**(`signal?`): `Promise`\<[`ActivationReport`](/api/metrics-core/src/type-aliases/activationreport/)\>

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`ActivationReport`](/api/metrics-core/src/type-aliases/activationreport/)\>

---

### read()

> **read**(`id`, `signal?`): `Promise`\<`Readonly`\<\{ `definitionHash`: `string`; `id`: `string`; `inputHash`: `string`; `report`: [`ActivationReport`](/api/metrics-core/src/type-aliases/activationreport/); `reportHash`: `string`; `scope`: [`ActivationAdminScope`](/api/admin-core/src/type-aliases/activationadminscope/); `selectedCandidateId`: `string`; `selectedCohort`: `"new"` \| `"returning"`; `sourceRunRef`: `string`; \}\>\>

#### Parameters

##### id

`string`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`Readonly`\<\{ `definitionHash`: `string`; `id`: `string`; `inputHash`: `string`; `report`: [`ActivationReport`](/api/metrics-core/src/type-aliases/activationreport/); `reportHash`: `string`; `scope`: [`ActivationAdminScope`](/api/admin-core/src/type-aliases/activationadminscope/); `selectedCandidateId`: `string`; `selectedCohort`: `"new"` \| `"returning"`; `sourceRunRef`: `string`; \}\>\>

---

### save()

> **save**(`id`, `candidateId`, `cohort`, `expectedReport`, `signal?`): `Promise`\<`Readonly`\<\{ `definitionHash`: `string`; `id`: `string`; `inputHash`: `string`; `report`: [`ActivationReport`](/api/metrics-core/src/type-aliases/activationreport/); `reportHash`: `string`; `scope`: [`ActivationAdminScope`](/api/admin-core/src/type-aliases/activationadminscope/); `selectedCandidateId`: `string`; `selectedCohort`: `"new"` \| `"returning"`; `sourceRunRef`: `string`; \}\>\>

#### Parameters

##### id

`string`

##### candidateId

`string`

##### cohort

`"new"` \| `"returning"`

##### expectedReport

[`ActivationReport`](/api/metrics-core/src/type-aliases/activationreport/)

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`Readonly`\<\{ `definitionHash`: `string`; `id`: `string`; `inputHash`: `string`; `report`: [`ActivationReport`](/api/metrics-core/src/type-aliases/activationreport/); `reportHash`: `string`; `scope`: [`ActivationAdminScope`](/api/admin-core/src/type-aliases/activationadminscope/); `selectedCandidateId`: `string`; `selectedCohort`: `"new"` \| `"returning"`; `sourceRunRef`: `string`; \}\>\>
