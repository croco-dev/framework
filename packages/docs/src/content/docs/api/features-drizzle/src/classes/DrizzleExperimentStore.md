---
editUrl: false
next: false
prev: false
title: "DrizzleExperimentStore"
---

PostgreSQL owns admission and command serialization, including across application restarts.

## Implements

- [`ExperimentStore`](/api/features-core/src/interfaces/experimentstore/)

## Constructors

### Constructor

> **new DrizzleExperimentStore**(`database`): `DrizzleExperimentStore`

#### Parameters

##### database

[`FeaturePolicyPgDatabase`](/api/features-drizzle/src/interfaces/featurepolicypgdatabase/)

#### Returns

`DrizzleExperimentStore`

## Methods

### admit()

> **admit**(`id`, `scope`, `subject`, `now`): `Promise`\<[`ExperimentAdmission`](/api/features-core/src/type-aliases/experimentadmission/)\>

Rechecks current running state at the treatment admission boundary.

#### Parameters

##### id

`string`

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

##### subject

[`ExperimentSubject`](/api/features-core/src/type-aliases/experimentsubject/)

##### now

`string`

#### Returns

`Promise`\<[`ExperimentAdmission`](/api/features-core/src/type-aliases/experimentadmission/)\>

#### Implementation of

[`ExperimentStore`](/api/features-core/src/interfaces/experimentstore/).[`admit`](/api/features-core/src/interfaces/experimentstore/#admit)

---

### assign()

> **assign**(`candidate`, `now`): `Promise`\<[`ExperimentAdmission`](/api/features-core/src/type-aliases/experimentadmission/)\>

Returns the unique stored winner; validates running state and time window atomically.

#### Parameters

##### candidate

[`ExperimentAssignment`](/api/features-core/src/type-aliases/experimentassignment/)

##### now

`string`

#### Returns

`Promise`\<[`ExperimentAdmission`](/api/features-core/src/type-aliases/experimentadmission/)\>

#### Implementation of

[`ExperimentStore`](/api/features-core/src/interfaces/experimentstore/).[`assign`](/api/features-core/src/interfaces/experimentstore/#assign)

---

### command()

> **command**(`command`, `fingerprint`, `now`): `Promise`\<[`ExperimentCommandReceipt`](/api/features-core/src/type-aliases/experimentcommandreceipt/)\>

#### Parameters

##### command

[`ExperimentCommand`](/api/features-core/src/type-aliases/experimentcommand/)

##### fingerprint

`string`

##### now

`string`

#### Returns

`Promise`\<[`ExperimentCommandReceipt`](/api/features-core/src/type-aliases/experimentcommandreceipt/)\>

#### Implementation of

[`ExperimentStore`](/api/features-core/src/interfaces/experimentstore/).[`command`](/api/features-core/src/interfaces/experimentstore/#command)

---

### configure()

> **configure**(`command`, `record`, `fingerprint`, `now`): `Promise`\<[`ExperimentConfigureReceipt`](/api/features-core/src/type-aliases/experimentconfigurereceipt/)\>

#### Parameters

##### command

[`ExperimentConfigureCommand`](/api/features-core/src/type-aliases/experimentconfigurecommand/)

##### record

[`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/)

##### fingerprint

`string`

##### now

`string`

#### Returns

`Promise`\<[`ExperimentConfigureReceipt`](/api/features-core/src/type-aliases/experimentconfigurereceipt/)\>

#### Implementation of

[`ExperimentStore`](/api/features-core/src/interfaces/experimentstore/).[`configure`](/api/features-core/src/interfaces/experimentstore/#configure)

---

### get()

> **get**(`target`): `Promise`\<[`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/) \| `null`\>

#### Parameters

##### target

[`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/)

#### Returns

`Promise`\<[`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/) \| `null`\>

#### Implementation of

[`ExperimentStore`](/api/features-core/src/interfaces/experimentstore/).[`get`](/api/features-core/src/interfaces/experimentstore/#get)

---

### getAssignment()

> **getAssignment**(`id`): `Promise`\<[`ExperimentAssignment`](/api/features-core/src/type-aliases/experimentassignment/) \| `null`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`ExperimentAssignment`](/api/features-core/src/type-aliases/experimentassignment/) \| `null`\>

#### Implementation of

[`ExperimentStore`](/api/features-core/src/interfaces/experimentstore/).[`getAssignment`](/api/features-core/src/interfaces/experimentstore/#getassignment)

---

### list()

> **list**(`scope`): `Promise`\<readonly [`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/)[]\>

#### Parameters

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

#### Returns

`Promise`\<readonly [`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/)[]\>

#### Implementation of

[`ExperimentStore`](/api/features-core/src/interfaces/experimentstore/).[`list`](/api/features-core/src/interfaces/experimentstore/#list)

---

### recordExposure()

> **recordExposure**(`exposure`, `scope`, `subject`): `Promise`\<[`ExperimentExposure`](/api/features-core/src/type-aliases/experimentexposure/)\>

Validates original assignment ownership; dedupes assignmentId+deliveryInstanceId.

#### Parameters

##### exposure

[`ExperimentExposure`](/api/features-core/src/type-aliases/experimentexposure/)

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

##### subject

[`ExperimentSubject`](/api/features-core/src/type-aliases/experimentsubject/)

#### Returns

`Promise`\<[`ExperimentExposure`](/api/features-core/src/type-aliases/experimentexposure/)\>

#### Implementation of

[`ExperimentStore`](/api/features-core/src/interfaces/experimentstore/).[`recordExposure`](/api/features-core/src/interfaces/experimentstore/#recordexposure)

---

### register()

> **register**(`record`): `Promise`\<[`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/)\>

#### Parameters

##### record

[`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/)

#### Returns

`Promise`\<[`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/)\>

#### Implementation of

[`ExperimentStore`](/api/features-core/src/interfaces/experimentstore/).[`register`](/api/features-core/src/interfaces/experimentstore/#register)
