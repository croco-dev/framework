---
editUrl: false
next: false
prev: false
title: "DrizzleReminderStore"
---

Serializes each app/environment/tenant/subject, including an initially empty subject.

## Implements

- [`ReminderStore`](/api/engagement-core/src/interfaces/reminderstore/)

## Constructors

### Constructor

> **new DrizzleReminderStore**(`db`): `DrizzleReminderStore`

#### Parameters

##### db

[`DrizzleReminderClient`](/api/engagement-drizzle/src/type-aliases/drizzlereminderclient/)

#### Returns

`DrizzleReminderStore`

## Methods

### transact()

> **transact**\<`T`\>(`scope`, `subject`, `operation`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### scope

[`ReminderScope`](/api/engagement-core/src/type-aliases/reminderscope/)

##### subject

`string`

##### operation

(`transaction`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

#### Implementation of

[`ReminderStore`](/api/engagement-core/src/interfaces/reminderstore/).[`transact`](/api/engagement-core/src/interfaces/reminderstore/#transact)
