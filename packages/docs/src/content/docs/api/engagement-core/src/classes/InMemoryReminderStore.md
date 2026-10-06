---
editUrl: false
next: false
prev: false
title: "InMemoryReminderStore"
---

Development/test store. Production adapters must durably serialize each subject transaction.

## Implements

- [`ReminderStore`](/api/engagement-core/src/interfaces/reminderstore/)

## Constructors

### Constructor

> **new InMemoryReminderStore**(): `InMemoryReminderStore`

#### Returns

`InMemoryReminderStore`

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
