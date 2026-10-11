---
editUrl: false
next: false
prev: false
title: "ExperimentRuntime"
---

## Constructors

### Constructor

> **new ExperimentRuntime**(`options`): `ExperimentRuntime`

#### Parameters

##### options

[`ExperimentRuntimeOptions`](/api/features-core/src/type-aliases/experimentruntimeoptions/)

#### Returns

`ExperimentRuntime`

## Methods

### assign()

> **assign**(`input`): `Promise`\<[`ExperimentAssignmentResult`](/api/features-core/src/type-aliases/experimentassignmentresult/)\>

#### Parameters

##### input

[`ExperimentInput`](/api/features-core/src/type-aliases/experimentinput/)

#### Returns

`Promise`\<[`ExperimentAssignmentResult`](/api/features-core/src/type-aliases/experimentassignmentresult/)\>

---

### command()

> **command**(`command`): `Promise`\<[`ExperimentCommandReceipt`](/api/features-core/src/type-aliases/experimentcommandreceipt/)\>

#### Parameters

##### command

[`ExperimentCommand`](/api/features-core/src/type-aliases/experimentcommand/)

#### Returns

`Promise`\<[`ExperimentCommandReceipt`](/api/features-core/src/type-aliases/experimentcommandreceipt/)\>

---

### configure()

> **configure**(`command`): `Promise`\<[`ExperimentConfigureReceipt`](/api/features-core/src/type-aliases/experimentconfigurereceipt/)\>

#### Parameters

##### command

[`ExperimentConfigureCommand`](/api/features-core/src/type-aliases/experimentconfigurecommand/)

#### Returns

`Promise`\<[`ExperimentConfigureReceipt`](/api/features-core/src/type-aliases/experimentconfigurereceipt/)\>

---

### evaluateDetailed()

> **evaluateDetailed**(`input`): `Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\>

#### Parameters

##### input

[`ExperimentInput`](/api/features-core/src/type-aliases/experimentinput/)

#### Returns

`Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\>

---

### get()

> **get**(`target`, `actor`): `Promise`\<[`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/) \| `null`\>

#### Parameters

##### target

[`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/)

##### actor

`string`

#### Returns

`Promise`\<[`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/) \| `null`\>

---

### getEligibilityIds()

> **getEligibilityIds**(): readonly `string`[]

#### Returns

readonly `string`[]

---

### list()

> **list**(`scope`, `actor`): `Promise`\<readonly [`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/)[]\>

#### Parameters

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

##### actor

`string`

#### Returns

`Promise`\<readonly [`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/)[]\>

---

### pause()

> **pause**(`command`): `Promise`\<[`ExperimentCommandReceipt`](/api/features-core/src/type-aliases/experimentcommandreceipt/)\>

#### Parameters

##### command

`Omit`\<[`ExperimentCommand`](/api/features-core/src/type-aliases/experimentcommand/), `"action"`\>

#### Returns

`Promise`\<[`ExperimentCommandReceipt`](/api/features-core/src/type-aliases/experimentcommandreceipt/)\>

---

### preview()

> **preview**(`input`): `Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\>

Read-only preview uses only an explicitly side-effect-free provider capability.

#### Parameters

##### input

[`ExperimentInput`](/api/features-core/src/type-aliases/experimentinput/)

#### Returns

`Promise`\<[`DetailedEvaluation`](/api/features-core/src/type-aliases/detailedevaluation/)\>

---

### recordExposure()

> **recordExposure**(`input`): `Promise`\<[`ExperimentExposure`](/api/features-core/src/type-aliases/experimentexposure/)\>

#### Parameters

##### input

[`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/) & `object` & `object`

#### Returns

`Promise`\<[`ExperimentExposure`](/api/features-core/src/type-aliases/experimentexposure/)\>

---

### register()

> **register**(`registration`, `scope`, `actor`): `Promise`\<[`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/)\>

#### Parameters

##### registration

[`ExperimentRegistration`](/api/features-core/src/type-aliases/experimentregistration/)

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

##### actor

`string`

#### Returns

`Promise`\<[`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/)\>

---

### registerEligibility()

> **registerEligibility**(`id`, `predicate`): `void`

#### Parameters

##### id

`string`

##### predicate

(`input`, `now`) => [`ExperimentEligibility`](/api/features-core/src/type-aliases/experimenteligibility/) \| `Promise`\<[`ExperimentEligibility`](/api/features-core/src/type-aliases/experimenteligibility/)\>

#### Returns

`void`

---

### restore()

> **restore**(`sourceTarget`, `actor`): `Promise`\<readonly [`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/)[]\>

Rebind persisted operator revisions to a trusted code template after process restart.

#### Parameters

##### sourceTarget

[`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/)

##### actor

`string`

#### Returns

`Promise`\<readonly [`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/)[]\>

---

### start()

> **start**(`command`): `Promise`\<[`ExperimentCommandReceipt`](/api/features-core/src/type-aliases/experimentcommandreceipt/)\>

#### Parameters

##### command

`Omit`\<[`ExperimentCommand`](/api/features-core/src/type-aliases/experimentcommand/), `"action"`\>

#### Returns

`Promise`\<[`ExperimentCommandReceipt`](/api/features-core/src/type-aliases/experimentcommandreceipt/)\>

---

### stop()

> **stop**(`command`): `Promise`\<[`ExperimentCommandReceipt`](/api/features-core/src/type-aliases/experimentcommandreceipt/)\>

#### Parameters

##### command

`Omit`\<[`ExperimentCommand`](/api/features-core/src/type-aliases/experimentcommand/), `"action"`\>

#### Returns

`Promise`\<[`ExperimentCommandReceipt`](/api/features-core/src/type-aliases/experimentcommandreceipt/)\>

---

### treat()

> **treat**(`input`): `Promise`\<\{ `status`: `"treated"`; `value`: `unknown`; \} \| \{ `reason`: `string`; `status`: `"not_assigned"`; \}\>

Admission is linearized with pause in the store. Admitted handlers may finish after pause.

#### Parameters

##### input

[`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/) & `object` & `object`

#### Returns

`Promise`\<\{ `status`: `"treated"`; `value`: `unknown`; \} \| \{ `reason`: `string`; `status`: `"not_assigned"`; \}\>
