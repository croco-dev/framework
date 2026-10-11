---
editUrl: false
next: false
prev: false
title: "ExperiencePgDatabase"
---

## Extends

- [`ExperiencePgExecutor`](/api/experience-drizzle/src/interfaces/experiencepgexecutor/)

## Methods

### execute()

> **execute**(`query`): `Promise`\<\{ `rows`: `Record`\<`string`, `unknown`\>[]; \}\>

#### Parameters

##### query

`SQL`

#### Returns

`Promise`\<\{ `rows`: `Record`\<`string`, `unknown`\>[]; \}\>

#### Inherited from

[`ExperiencePgExecutor`](/api/experience-drizzle/src/interfaces/experiencepgexecutor/).[`execute`](/api/experience-drizzle/src/interfaces/experiencepgexecutor/#execute)

---

### transaction()

> **transaction**\<`T`\>(`work`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### work

(`tx`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>
