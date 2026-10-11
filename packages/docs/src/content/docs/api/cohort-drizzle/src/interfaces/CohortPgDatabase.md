---
editUrl: false
next: false
prev: false
title: "CohortPgDatabase"
---

## Extends

- [`CohortPgExecutor`](/api/cohort-drizzle/src/interfaces/cohortpgexecutor/)

## Methods

### execute()

> **execute**(`query`): `Promise`\<\{ `rows`: `Record`\<`string`, `unknown`\>[]; \}\>

#### Parameters

##### query

`SQL`

#### Returns

`Promise`\<\{ `rows`: `Record`\<`string`, `unknown`\>[]; \}\>

#### Inherited from

[`CohortPgExecutor`](/api/cohort-drizzle/src/interfaces/cohortpgexecutor/).[`execute`](/api/cohort-drizzle/src/interfaces/cohortpgexecutor/#execute)

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
