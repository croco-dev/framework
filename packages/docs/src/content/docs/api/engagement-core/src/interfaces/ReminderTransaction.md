---
editUrl: false
next: false
prev: false
title: "ReminderTransaction"
---

## Properties

### mutations

> `readonly` **mutations**: readonly `Readonly`\<\{ `actor`: `string`; `evidence?`: `string`; `fingerprint`: `string`; `idempotencyKey`: `string`; `occurrenceId?`: `string`; `outcome?`: `"accepted"` \| `"not-accepted"`; `reason`: `string`; `recordedAt`: `Date`; `result`: [`Reminder`](/api/engagement-core/src/type-aliases/reminder/); \}\>[]

---

### occurrences

> `readonly` **occurrences**: readonly `Readonly`\<\{ `executionIds`: readonly `string`[]; `id`: `string`; `reason?`: `"preference"` \| `"suppression"` \| `"no-endpoint"` \| `"canceled"` \| `"superseded"` \| `"resource-completed"` \| `"resource-deleted"` \| `"skip-missed"` \| `"send-failed"` \| `"acceptance-unknown"`; `reminderId`: `string`; `reminderVersion`: `number`; `scheduledAt`: `Date`; `state`: `"queued"` \| `"suppressed"` \| `"pending"` \| `"expired"` \| `"unknown"` \| `"claimed"`; \}\>[]

---

### reminders

> `readonly` **reminders**: readonly [`Reminder`](/api/engagement-core/src/type-aliases/reminder/)[]

## Methods

### saveMutation()

> **saveMutation**(`mutation`): `void`

#### Parameters

##### mutation

[`ReminderMutation`](/api/engagement-core/src/type-aliases/remindermutation/)

#### Returns

`void`

---

### saveOccurrence()

> **saveOccurrence**(`occurrence`): `void`

#### Parameters

##### occurrence

[`ReminderOccurrence`](/api/engagement-core/src/type-aliases/reminderoccurrence/)

#### Returns

`void`

---

### saveReminder()

> **saveReminder**(`reminder`): `void`

#### Parameters

##### reminder

[`Reminder`](/api/engagement-core/src/type-aliases/reminder/)

#### Returns

`void`
