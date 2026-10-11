---
editUrl: false
next: false
prev: false
title: "ActivationCandidateOperationsOptions"
---

> **ActivationCandidateOperationsOptions** = `object`

## Properties

### store

> **store**: `object`

Trusted host persistence: isolate all scope fields and authorize every write.
The report digest detects corruption; it is not a signature against a writer who can replace the payload and digest.

#### read()

> **read**(`scope`, `id`, `signal?`): `Promise`\<`Readonly`\<\{ `definitionHash`: `string`; `id`: `string`; `inputHash`: `string`; `report`: [`ActivationReport`](/api/metrics-core/src/type-aliases/activationreport/); `reportHash`: `string`; `scope`: [`ActivationAdminScope`](/api/admin-core/src/type-aliases/activationadminscope/); `selectedCandidateId`: `string`; `selectedCohort`: `"new"` \| `"returning"`; `sourceRunRef`: `string`; \}\> \| `undefined`\>

##### Parameters

###### scope

[`ActivationAdminScope`](/api/admin-core/src/type-aliases/activationadminscope/)

###### id

`string`

###### signal?

`AbortSignal`

##### Returns

`Promise`\<`Readonly`\<\{ `definitionHash`: `string`; `id`: `string`; `inputHash`: `string`; `report`: [`ActivationReport`](/api/metrics-core/src/type-aliases/activationreport/); `reportHash`: `string`; `scope`: [`ActivationAdminScope`](/api/admin-core/src/type-aliases/activationadminscope/); `selectedCandidateId`: `string`; `selectedCohort`: `"new"` \| `"returning"`; `sourceRunRef`: `string`; \}\> \| `undefined`\>

#### write()

> **write**(`scope`, `record`, `signal?`): `Promise`\<`void`\>

##### Parameters

###### scope

[`ActivationAdminScope`](/api/admin-core/src/type-aliases/activationadminscope/)

###### record

[`ActivationSavedReport`](/api/admin-core/src/type-aliases/activationsavedreport/)

###### signal?

`AbortSignal`

##### Returns

`Promise`\<`void`\>

## Methods

### authenticate()

> **authenticate**(): `Promise`\<`Readonly`\<\{ `permissions`: readonly (`"activation.read"` \| `"activation.report-write"`)[]; `scope`: [`ActivationAdminScope`](/api/admin-core/src/type-aliases/activationadminscope/); \}\>\>

Resolve the authenticated server session, never request-supplied grants.

#### Returns

`Promise`\<`Readonly`\<\{ `permissions`: readonly (`"activation.read"` \| `"activation.report-write"`)[]; `scope`: [`ActivationAdminScope`](/api/admin-core/src/type-aliases/activationadminscope/); \}\>\>

---

### loadInput()

> **loadInput**(`scope`, `sourceRunRef?`, `signal?`): `Promise`\<\{ `definition`: [`ActivationDefinition`](/api/metrics-core/src/type-aliases/activationdefinition/); `rows`: readonly [`ActivationRow`](/api/metrics-core/src/type-aliases/activationrow/)[]; \}\>

Resolve an immutable, scope-bound source run; undefined selects the current run.

#### Parameters

##### scope

[`ActivationAdminScope`](/api/admin-core/src/type-aliases/activationadminscope/)

##### sourceRunRef?

`string`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<\{ `definition`: [`ActivationDefinition`](/api/metrics-core/src/type-aliases/activationdefinition/); `rows`: readonly [`ActivationRow`](/api/metrics-core/src/type-aliases/activationrow/)[]; \}\>
