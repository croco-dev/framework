---
editUrl: false
next: false
prev: false
title: "ReminderService"
---

## Constructors

### Constructor

> **new ReminderService**(`options`): `ReminderService`

#### Parameters

##### options

[`ReminderServiceOptions`](/api/engagement-core/src/type-aliases/reminderserviceoptions/)

#### Returns

`ReminderService`

## Methods

### cancel()

> **cancel**(`command`): `Promise`\<[`Reminder`](/api/engagement-core/src/type-aliases/reminder/)\>

#### Parameters

##### command

[`ReminderRevisionCommand`](/api/engagement-core/src/type-aliases/reminderrevisioncommand/)

#### Returns

`Promise`\<[`Reminder`](/api/engagement-core/src/type-aliases/reminder/)\>

---

### create()

> **create**(`command`): `Promise`\<[`Reminder`](/api/engagement-core/src/type-aliases/reminder/)\>

#### Parameters

##### command

`Readonly`\<\{ `actor`: [`ReminderActor`](/api/engagement-core/src/type-aliases/reminderactor/); `scope`: [`ReminderScope`](/api/engagement-core/src/type-aliases/reminderscope/); `subject`: `string`; \}\> & `Readonly`\<\{ `idempotencyKey`: `string`; \}\> & `object`

#### Returns

`Promise`\<[`Reminder`](/api/engagement-core/src/type-aliases/reminder/)\>

---

### dueOccurrences()

> **dueOccurrences**(`access`): `Promise`\<readonly `Readonly`\<\{ `executionIds`: readonly `string`[]; `id`: `string`; `reason?`: `"preference"` \| `"suppression"` \| `"no-endpoint"` \| `"canceled"` \| `"superseded"` \| `"resource-completed"` \| `"resource-deleted"` \| `"skip-missed"` \| `"send-failed"` \| `"acceptance-unknown"`; `reminderId`: `string`; `reminderVersion`: `number`; `scheduledAt`: `Date`; `state`: `"queued"` \| `"suppressed"` \| `"pending"` \| `"expired"` \| `"unknown"` \| `"claimed"`; \}\>[]\>

#### Parameters

##### access

[`ReminderAccess`](/api/engagement-core/src/type-aliases/reminderaccess/)

#### Returns

`Promise`\<readonly `Readonly`\<\{ `executionIds`: readonly `string`[]; `id`: `string`; `reason?`: `"preference"` \| `"suppression"` \| `"no-endpoint"` \| `"canceled"` \| `"superseded"` \| `"resource-completed"` \| `"resource-deleted"` \| `"skip-missed"` \| `"send-failed"` \| `"acceptance-unknown"`; `reminderId`: `string`; `reminderVersion`: `number`; `scheduledAt`: `Date`; `state`: `"queued"` \| `"suppressed"` \| `"pending"` \| `"expired"` \| `"unknown"` \| `"claimed"`; \}\>[]\>

---

### history()

> **history**(`access`): `Promise`\<readonly `Readonly`\<\{ `executionIds`: readonly `string`[]; `id`: `string`; `reason?`: `"preference"` \| `"suppression"` \| `"no-endpoint"` \| `"canceled"` \| `"superseded"` \| `"resource-completed"` \| `"resource-deleted"` \| `"skip-missed"` \| `"send-failed"` \| `"acceptance-unknown"`; `reminderId`: `string`; `reminderVersion`: `number`; `scheduledAt`: `Date`; `state`: `"queued"` \| `"suppressed"` \| `"pending"` \| `"expired"` \| `"unknown"` \| `"claimed"`; \}\>[]\>

#### Parameters

##### access

[`ReminderAccess`](/api/engagement-core/src/type-aliases/reminderaccess/)

#### Returns

`Promise`\<readonly `Readonly`\<\{ `executionIds`: readonly `string`[]; `id`: `string`; `reason?`: `"preference"` \| `"suppression"` \| `"no-endpoint"` \| `"canceled"` \| `"superseded"` \| `"resource-completed"` \| `"resource-deleted"` \| `"skip-missed"` \| `"send-failed"` \| `"acceptance-unknown"`; `reminderId`: `string`; `reminderVersion`: `number`; `scheduledAt`: `Date`; `state`: `"queued"` \| `"suppressed"` \| `"pending"` \| `"expired"` \| `"unknown"` \| `"claimed"`; \}\>[]\>

---

### list()

> **list**(`access`): `Promise`\<readonly [`Reminder`](/api/engagement-core/src/type-aliases/reminder/)[]\>

#### Parameters

##### access

[`ReminderAccess`](/api/engagement-core/src/type-aliases/reminderaccess/)

#### Returns

`Promise`\<readonly [`Reminder`](/api/engagement-core/src/type-aliases/reminder/)[]\>

---

### reconcile()

> **reconcile**(`command`): `Promise`\<[`Reminder`](/api/engagement-core/src/type-aliases/reminder/)\>

#### Parameters

##### command

`Readonly`\<\{ `actor`: [`ReminderActor`](/api/engagement-core/src/type-aliases/reminderactor/); `scope`: [`ReminderScope`](/api/engagement-core/src/type-aliases/reminderscope/); `subject`: `string`; \}\> & `Readonly`\<\{ `idempotencyKey`: `string`; \}\> & `object`

#### Returns

`Promise`\<[`Reminder`](/api/engagement-core/src/type-aliases/reminder/)\>

---

### runDue()

> **runDue**(`access`): `Promise`\<readonly `Readonly`\<\{ `executionIds`: readonly `string`[]; `id`: `string`; `reason?`: `"preference"` \| `"suppression"` \| `"no-endpoint"` \| `"canceled"` \| `"superseded"` \| `"resource-completed"` \| `"resource-deleted"` \| `"skip-missed"` \| `"send-failed"` \| `"acceptance-unknown"`; `reminderId`: `string`; `reminderVersion`: `number`; `scheduledAt`: `Date`; `state`: `"queued"` \| `"suppressed"` \| `"pending"` \| `"expired"` \| `"unknown"` \| `"claimed"`; \}\>[]\>

#### Parameters

##### access

[`ReminderAccess`](/api/engagement-core/src/type-aliases/reminderaccess/)

#### Returns

`Promise`\<readonly `Readonly`\<\{ `executionIds`: readonly `string`[]; `id`: `string`; `reason?`: `"preference"` \| `"suppression"` \| `"no-endpoint"` \| `"canceled"` \| `"superseded"` \| `"resource-completed"` \| `"resource-deleted"` \| `"skip-missed"` \| `"send-failed"` \| `"acceptance-unknown"`; `reminderId`: `string`; `reminderVersion`: `number`; `scheduledAt`: `Date`; `state`: `"queued"` \| `"suppressed"` \| `"pending"` \| `"expired"` \| `"unknown"` \| `"claimed"`; \}\>[]\>

---

### snooze()

> **snooze**(`command`): `Promise`\<[`Reminder`](/api/engagement-core/src/type-aliases/reminder/)\>

#### Parameters

##### command

`Readonly`\<\{ `actor`: [`ReminderActor`](/api/engagement-core/src/type-aliases/reminderactor/); `scope`: [`ReminderScope`](/api/engagement-core/src/type-aliases/reminderscope/); `subject`: `string`; \}\> & `Readonly`\<\{ `idempotencyKey`: `string`; \}\> & `Readonly`\<\{ `expectedVersion`: `number`; `id`: `string`; \}\> & `object`

#### Returns

`Promise`\<[`Reminder`](/api/engagement-core/src/type-aliases/reminder/)\>

---

### update()

> **update**(`command`): `Promise`\<[`Reminder`](/api/engagement-core/src/type-aliases/reminder/)\>

#### Parameters

##### command

`Readonly`\<\{ `actor`: [`ReminderActor`](/api/engagement-core/src/type-aliases/reminderactor/); `scope`: [`ReminderScope`](/api/engagement-core/src/type-aliases/reminderscope/); `subject`: `string`; \}\> & `Readonly`\<\{ `idempotencyKey`: `string`; \}\> & `Readonly`\<\{ `expectedVersion`: `number`; `id`: `string`; \}\> & `object`

#### Returns

`Promise`\<[`Reminder`](/api/engagement-core/src/type-aliases/reminder/)\>
