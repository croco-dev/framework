---
editUrl: false
next: false
prev: false
title: "ReminderStore"
---

Serializes each app/environment/tenant/subject, including an initially empty subject.

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
