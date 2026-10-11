---
editUrl: false
next: false
prev: false
title: "PolicyScheduleLookup"
---

## Extends

- [`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/)\<`TValue`\>

## Type Parameters

### TValue

`TValue` = `unknown`

## Methods

### appendAudit()?

> `optional` **appendAudit**(`entry`): `Promise`\<`void`\>

#### Parameters

##### entry

[`PolicyAuditEntry`](/api/features-core/src/type-aliases/policyauditentry/)

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`appendAudit`](/api/features-core/src/interfaces/policyreleasestore/#appendaudit)

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

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`attachScheduleExecution`](/api/features-core/src/interfaces/policyreleasestore/#attachscheduleexecution)

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

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`cancelSchedule`](/api/features-core/src/interfaces/policyreleasestore/#cancelschedule)

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

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`claimSchedule`](/api/features-core/src/interfaces/policyreleasestore/#claimschedule)

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

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`completeSchedule`](/api/features-core/src/interfaces/policyreleasestore/#completeschedule)

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

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`create`](/api/features-core/src/interfaces/policyreleasestore/#create)

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

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`failSchedule`](/api/features-core/src/interfaces/policyreleasestore/#failschedule)

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

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`findCommandReceipt`](/api/features-core/src/interfaces/policyreleasestore/#findcommandreceipt)

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

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`get`](/api/features-core/src/interfaces/policyreleasestore/#get)

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

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`getRevision`](/api/features-core/src/interfaces/policyreleasestore/#getrevision)

---

### getSchedule()

> **getSchedule**(`scheduleId`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/) \| `null`\>

#### Parameters

##### scheduleId

`string`

#### Returns

`Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/) \| `null`\>

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

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`list`](/api/features-core/src/interfaces/policyreleasestore/#list)

---

### listAudit()?

> `optional` **listAudit**(`policyId`, `scope`): `Promise`\<readonly [`PolicyAuditEntry`](/api/features-core/src/type-aliases/policyauditentry/)[]\>

#### Parameters

##### policyId

`string`

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

#### Returns

`Promise`\<readonly [`PolicyAuditEntry`](/api/features-core/src/type-aliases/policyauditentry/)[]\>

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`listAudit`](/api/features-core/src/interfaces/policyreleasestore/#listaudit)

---

### listDueSchedules()

> **listDueSchedules**(`now`, `limit?`): `Promise`\<readonly [`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)[]\>

#### Parameters

##### now

`Date`

##### limit?

`number`

#### Returns

`Promise`\<readonly [`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)[]\>

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`listDueSchedules`](/api/features-core/src/interfaces/policyreleasestore/#listdueschedules)

---

### recordPause()

> **recordPause**(`input`): `Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)\>

#### Parameters

##### input

[`PolicyPauseInput`](/api/features-core/src/type-aliases/policypauseinput/)\<`TValue`\>

#### Returns

`Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)\>

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`recordPause`](/api/features-core/src/interfaces/policyreleasestore/#recordpause)

---

### recordPublication()

> **recordPublication**(`input`): `Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)\>

#### Parameters

##### input

[`PolicyPublicationInput`](/api/features-core/src/type-aliases/policypublicationinput/)\<`TValue`\>

#### Returns

`Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)\>

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`recordPublication`](/api/features-core/src/interfaces/policyreleasestore/#recordpublication)

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

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`resolve`](/api/features-core/src/interfaces/policyreleasestore/#resolve)

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

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`save`](/api/features-core/src/interfaces/policyreleasestore/#save)

---

### schedule()

> **schedule**(`input`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Parameters

##### input

[`PolicyScheduleInput`](/api/features-core/src/type-aliases/policyscheduleinput/)

#### Returns

`Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Inherited from

[`PolicyReleaseStore`](/api/features-core/src/interfaces/policyreleasestore/).[`schedule`](/api/features-core/src/interfaces/policyreleasestore/#schedule)
