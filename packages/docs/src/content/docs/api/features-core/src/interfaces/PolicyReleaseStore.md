---
editUrl: false
next: false
prev: false
title: "PolicyReleaseStore"
---

## Extended by

- [`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/)

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

---

### recordPause()

> **recordPause**(`input`): `Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)\>

#### Parameters

##### input

[`PolicyPauseInput`](/api/features-core/src/type-aliases/policypauseinput/)\<`TValue`\>

#### Returns

`Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)\>

---

### recordPublication()

> **recordPublication**(`input`): `Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)\>

#### Parameters

##### input

[`PolicyPublicationInput`](/api/features-core/src/type-aliases/policypublicationinput/)\<`TValue`\>

#### Returns

`Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)\>

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

---

### schedule()

> **schedule**(`input`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Parameters

##### input

[`PolicyScheduleInput`](/api/features-core/src/type-aliases/policyscheduleinput/)

#### Returns

`Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>
