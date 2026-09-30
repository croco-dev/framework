---
editUrl: false
next: false
prev: false
title: "DrizzlePolicyReleaseStore"
---

PostgreSQL persistence for policy revisions, activation pointers, receipts, and schedules.

## Type Parameters

### TValue

`TValue` = `unknown`

## Implements

- [`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/)\<`TValue`\>

## Constructors

### Constructor

> **new DrizzlePolicyReleaseStore**\<`TValue`\>(`database`, `options?`): `DrizzlePolicyReleaseStore`\<`TValue`\>

#### Parameters

##### database

[`FeaturePolicyPgDatabase`](/api/features-drizzle/src/interfaces/featurepolicypgdatabase/)

##### options?

[`DrizzlePolicyReleaseStoreOptions`](/api/features-drizzle/src/type-aliases/drizzlepolicyreleasestoreoptions/) = `{}`

#### Returns

`DrizzlePolicyReleaseStore`\<`TValue`\>

## Methods

### appendAudit()

> **appendAudit**(`entry`): `Promise`\<`void`\>

#### Parameters

##### entry

[`PolicyAuditEntry`](/api/features-core/src/type-aliases/policyauditentry/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`appendAudit`](/api/features-core/src/interfaces/policyschedulelookup/#appendaudit)

---

### attachScheduleExecution()

> **attachScheduleExecution**(`scheduleId`, `executionId`, `triggerId?`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Parameters

##### scheduleId

`string`

##### executionId

`string`

##### triggerId?

`string`

#### Returns

`Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`attachScheduleExecution`](/api/features-core/src/interfaces/policyschedulelookup/#attachscheduleexecution)

---

### cancelSchedule()

> **cancelSchedule**(`scheduleId`, `now`, `reason`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Parameters

##### scheduleId

`string`

##### now

`Date`

##### reason

`string`

#### Returns

`Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`cancelSchedule`](/api/features-core/src/interfaces/policyschedulelookup/#cancelschedule)

---

### claimSchedule()

> **claimSchedule**(`scheduleId`, `workerId`, `now`, `leaseMs`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/) \| `null`\>

#### Parameters

##### scheduleId

`string`

##### workerId

`string`

##### now

`Date`

##### leaseMs

`number`

#### Returns

`Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/) \| `null`\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`claimSchedule`](/api/features-core/src/interfaces/policyschedulelookup/#claimschedule)

---

### completeSchedule()

> **completeSchedule**(`scheduleId`, `now`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Parameters

##### scheduleId

`string`

##### now

`Date`

#### Returns

`Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`completeSchedule`](/api/features-core/src/interfaces/policyschedulelookup/#completeschedule)

---

### create()

> **create**(`revision`, `definition?`): `Promise`\<`void`\>

#### Parameters

##### revision

[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>

##### definition?

[`PolicyDefinitionRecord`](/api/features-core/src/type-aliases/policydefinitionrecord/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`create`](/api/features-core/src/interfaces/policyschedulelookup/#create)

---

### failSchedule()

> **failSchedule**(`scheduleId`, `now`, `error`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Parameters

##### scheduleId

`string`

##### now

`Date`

##### error

`string`

#### Returns

`Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`failSchedule`](/api/features-core/src/interfaces/policyschedulelookup/#failschedule)

---

### findCommandReceipt()

> **findCommandReceipt**(`scope`, `policyId`, `idempotencyKey`): `Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/) \| `null`\>

#### Parameters

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

##### policyId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/) \| `null`\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`findCommandReceipt`](/api/features-core/src/interfaces/policyschedulelookup/#findcommandreceipt)

---

### get()

> **get**(`scope`, `policyId`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\> \| `null`\>

#### Parameters

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

##### policyId

`string`

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\> \| `null`\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`get`](/api/features-core/src/interfaces/policyschedulelookup/#get)

---

### getRevision()

> **getRevision**(`scope`, `policyId`, `revision`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\> \| `null`\>

#### Parameters

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

##### policyId

`string`

##### revision

`number`

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\> \| `null`\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`getRevision`](/api/features-core/src/interfaces/policyschedulelookup/#getrevision)

---

### getSchedule()

> **getSchedule**(`scheduleId`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/) \| `null`\>

#### Parameters

##### scheduleId

`string`

#### Returns

`Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/) \| `null`\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`getSchedule`](/api/features-core/src/interfaces/policyschedulelookup/#getschedule)

---

### list()

> **list**(`scope`, `policyId`): `Promise`\<readonly [`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>[]\>

#### Parameters

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

##### policyId

`string`

#### Returns

`Promise`\<readonly [`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>[]\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`list`](/api/features-core/src/interfaces/policyschedulelookup/#list)

---

### listAudit()

> **listAudit**(`policyId`, `scope`): `Promise`\<readonly [`PolicyAuditEntry`](/api/features-core/src/type-aliases/policyauditentry/)[]\>

#### Parameters

##### policyId

`string`

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

#### Returns

`Promise`\<readonly [`PolicyAuditEntry`](/api/features-core/src/type-aliases/policyauditentry/)[]\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`listAudit`](/api/features-core/src/interfaces/policyschedulelookup/#listaudit)

---

### listDueSchedules()

> **listDueSchedules**(`now`, `limit?`): `Promise`\<readonly [`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)[]\>

#### Parameters

##### now

`Date`

##### limit?

`number` = `100`

#### Returns

`Promise`\<readonly [`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)[]\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`listDueSchedules`](/api/features-core/src/interfaces/policyschedulelookup/#listdueschedules)

---

### recordDecision()

> **recordDecision**(`input`): `Promise`\<[`PolicyDecisionReference`](/api/features-core/src/type-aliases/policydecisionreference/)\>

#### Parameters

##### input

[`PolicyDecisionInput`](/api/features-core/src/type-aliases/policydecisioninput/)\<`TValue`\>

#### Returns

`Promise`\<[`PolicyDecisionReference`](/api/features-core/src/type-aliases/policydecisionreference/)\>

---

### recordPause()

> **recordPause**(`input`): `Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)\>

#### Parameters

##### input

[`PolicyPauseInput`](/api/features-core/src/type-aliases/policypauseinput/)\<`TValue`\>

#### Returns

`Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`recordPause`](/api/features-core/src/interfaces/policyschedulelookup/#recordpause)

---

### recordPublication()

> **recordPublication**(`input`): `Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)\>

#### Parameters

##### input

[`PolicyPublicationInput`](/api/features-core/src/type-aliases/policypublicationinput/)\<`TValue`\>

#### Returns

`Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`recordPublication`](/api/features-core/src/interfaces/policyschedulelookup/#recordpublication)

---

### resolve()

> **resolve**(`scope`, `policyId`, `at`): `Promise`\<[`PolicyResolution`](/api/features-core/src/type-aliases/policyresolution/)\<`TValue`\>\>

#### Parameters

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

##### policyId

`string`

##### at

`Date`

#### Returns

`Promise`\<[`PolicyResolution`](/api/features-core/src/type-aliases/policyresolution/)\<`TValue`\>\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`resolve`](/api/features-core/src/interfaces/policyschedulelookup/#resolve)

---

### save()

> **save**(`revision`, `expectedRevision`, `definition?`): `Promise`\<`void`\>

#### Parameters

##### revision

[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>

##### expectedRevision

`number`

##### definition?

[`PolicyDefinitionRecord`](/api/features-core/src/type-aliases/policydefinitionrecord/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`save`](/api/features-core/src/interfaces/policyschedulelookup/#save)

---

### schedule()

> **schedule**(`input`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Parameters

##### input

[`PolicyScheduleInput`](/api/features-core/src/type-aliases/policyscheduleinput/)

#### Returns

`Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`schedule`](/api/features-core/src/interfaces/policyschedulelookup/#schedule)
