---
editUrl: false
next: false
prev: false
title: "ExperimentOperations"
---

Server-owned samples are authorized again by the runtime before evaluation.

## Constructors

### Constructor

> **new ExperimentOperations**(`runtime`, `samples`, `eligibilityOptions`): `ExperimentOperations`

#### Parameters

##### runtime

[`ExperimentRuntime`](/api/features-core/src/classes/experimentruntime/)

##### samples

(`access`) => readonly `Readonly`\<\{ `context?`: `Readonly`\<`Record`\<`string`, `unknown`\>\>; `id`: `string`; `label`: `string`; `subject`: [`ExperimentSubject`](/api/features-core/src/type-aliases/experimentsubject/); \}\>[]

##### eligibilityOptions

readonly `string`[]

#### Returns

`ExperimentOperations`

## Methods

### command()

> **command**(`command`, `access`): `Promise`\<`Readonly`\<\{ `canConfigure`: `boolean`; `canOperate`: `boolean`; `canPreview`: `boolean`; `definition`: `Omit`\<[`ExperimentDefinition`](/api/features-core/src/type-aliases/experimentdefinition/), `"salt"`\>; `eligibilityOptions`: readonly `string`[]; `samples`: readonly `Readonly`\<\{ `id`: `string`; `label`: `string`; \}\>[]; `state`: [`ExperimentState`](/api/features-core/src/type-aliases/experimentstate/); `target`: [`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/); `version`: `number`; \}\>\>

#### Parameters

##### command

[`ExperimentAdminCommand`](/api/admin-core/src/type-aliases/experimentadmincommand/)

##### access

[`ExperimentAdminAccess`](/api/admin-core/src/type-aliases/experimentadminaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `canConfigure`: `boolean`; `canOperate`: `boolean`; `canPreview`: `boolean`; `definition`: `Omit`\<[`ExperimentDefinition`](/api/features-core/src/type-aliases/experimentdefinition/), `"salt"`\>; `eligibilityOptions`: readonly `string`[]; `samples`: readonly `Readonly`\<\{ `id`: `string`; `label`: `string`; \}\>[]; `state`: [`ExperimentState`](/api/features-core/src/type-aliases/experimentstate/); `target`: [`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/); `version`: `number`; \}\>\>

---

### configure()

> **configure**(`command`, `access`): `Promise`\<`Readonly`\<\{ `canConfigure`: `boolean`; `canOperate`: `boolean`; `canPreview`: `boolean`; `definition`: `Omit`\<[`ExperimentDefinition`](/api/features-core/src/type-aliases/experimentdefinition/), `"salt"`\>; `eligibilityOptions`: readonly `string`[]; `samples`: readonly `Readonly`\<\{ `id`: `string`; `label`: `string`; \}\>[]; `state`: [`ExperimentState`](/api/features-core/src/type-aliases/experimentstate/); `target`: [`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/); `version`: `number`; \}\>\>

#### Parameters

##### command

[`ExperimentAdminConfigureCommand`](/api/admin-core/src/type-aliases/experimentadminconfigurecommand/)

##### access

[`ExperimentAdminAccess`](/api/admin-core/src/type-aliases/experimentadminaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `canConfigure`: `boolean`; `canOperate`: `boolean`; `canPreview`: `boolean`; `definition`: `Omit`\<[`ExperimentDefinition`](/api/features-core/src/type-aliases/experimentdefinition/), `"salt"`\>; `eligibilityOptions`: readonly `string`[]; `samples`: readonly `Readonly`\<\{ `id`: `string`; `label`: `string`; \}\>[]; `state`: [`ExperimentState`](/api/features-core/src/type-aliases/experimentstate/); `target`: [`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/); `version`: `number`; \}\>\>

---

### preview()

> **preview**(`target`, `sampleId`, `access`): `Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\>

#### Parameters

##### target

[`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/)

##### sampleId

`string`

##### access

[`ExperimentAdminAccess`](/api/admin-core/src/type-aliases/experimentadminaccess/)

#### Returns

`Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\>

---

### read()

> **read**(`target`, `access`): `Promise`\<`Readonly`\<\{ `canConfigure`: `boolean`; `canOperate`: `boolean`; `canPreview`: `boolean`; `definition`: `Omit`\<[`ExperimentDefinition`](/api/features-core/src/type-aliases/experimentdefinition/), `"salt"`\>; `eligibilityOptions`: readonly `string`[]; `samples`: readonly `Readonly`\<\{ `id`: `string`; `label`: `string`; \}\>[]; `state`: [`ExperimentState`](/api/features-core/src/type-aliases/experimentstate/); `target`: [`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/); `version`: `number`; \}\>\>

#### Parameters

##### target

[`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/)

##### access

[`ExperimentAdminAccess`](/api/admin-core/src/type-aliases/experimentadminaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `canConfigure`: `boolean`; `canOperate`: `boolean`; `canPreview`: `boolean`; `definition`: `Omit`\<[`ExperimentDefinition`](/api/features-core/src/type-aliases/experimentdefinition/), `"salt"`\>; `eligibilityOptions`: readonly `string`[]; `samples`: readonly `Readonly`\<\{ `id`: `string`; `label`: `string`; \}\>[]; `state`: [`ExperimentState`](/api/features-core/src/type-aliases/experimentstate/); `target`: [`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/); `version`: `number`; \}\>\>
