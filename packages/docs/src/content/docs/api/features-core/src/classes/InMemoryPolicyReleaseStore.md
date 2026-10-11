---
editUrl: false
next: false
prev: false
title: "InMemoryPolicyReleaseStore"
---

## Type Parameters

### TValue

`TValue` = `unknown`

## Implements

- [`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/)\<`TValue`\>

## Constructors

### Constructor

> **new InMemoryPolicyReleaseStore**\<`TValue`\>(): `InMemoryPolicyReleaseStore`\<`TValue`\>

#### Returns

`InMemoryPolicyReleaseStore`\<`TValue`\>

## Methods

### attachScheduleExecution()

> **attachScheduleExecution**(`id`, `executionId`, `triggerId?`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Parameters

##### id

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

> **cancelSchedule**(`id`, `now`, `reason`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Parameters

##### id

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

> **claimSchedule**(`id`, `workerId`, `now`, `leaseMs`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/) \| `null`\>

#### Parameters

##### id

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

> **completeSchedule**(`id`, `now`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Parameters

##### id

`string`

##### now

`Date`

#### Returns

`Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`completeSchedule`](/api/features-core/src/interfaces/policyschedulelookup/#completeschedule)

---

### create()

> **create**(`revision`): `Promise`\<`void`\>

#### Parameters

##### revision

[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/).[`create`](/api/features-core/src/interfaces/policyschedulelookup/#create)

---

### failSchedule()

> **failSchedule**(`id`, `now`, `error`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Parameters

##### id

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

> **getSchedule**(`id`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/) \| `null`\>

#### Parameters

##### id

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

> **save**(`revision`, `expectedRevision`): `Promise`\<`void`\>

#### Parameters

##### revision

[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>

##### expectedRevision

`number`

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
