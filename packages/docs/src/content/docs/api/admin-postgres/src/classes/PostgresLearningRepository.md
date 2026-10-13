---
editUrl: false
next: false
prev: false
title: "PostgresLearningRepository"
---

Apply the packaged migration explicitly. Construction and reads never perform DDL.

## Implements

- [`LearningRepository`](/api/admin-core/src/interfaces/learningrepository/)

## Constructors

### Constructor

> **new PostgresLearningRepository**(`database`): `PostgresLearningRepository`

#### Parameters

##### database

[`ExplorerPgDatabase`](/api/admin-postgres/src/interfaces/explorerpgdatabase/)

#### Returns

`PostgresLearningRepository`

## Methods

### commit()

> **commit**(`command`): `Promise`\<[`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/)\>

#### Parameters

##### command

[`LearningCommit`](/api/admin-core/src/type-aliases/learningcommit/)

#### Returns

`Promise`\<[`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/)\>

#### Implementation of

[`LearningRepository`](/api/admin-core/src/interfaces/learningrepository/).[`commit`](/api/admin-core/src/interfaces/learningrepository/#commit)

---

### history()

> **history**(`scope`, `id`, `before`, `limit`): `Promise`\<readonly `Readonly`\<\{ `actor`: `string`; `at`: `string`; `reason`: `string`; `record`: [`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/); \}\>[]\>

#### Parameters

##### scope

[`LearningScope`](/api/admin-core/src/type-aliases/learningscope/)

##### id

`string`

##### before

`number` \| `undefined`

##### limit

`number`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `actor`: `string`; `at`: `string`; `reason`: `string`; `record`: [`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/); \}\>[]\>

#### Implementation of

[`LearningRepository`](/api/admin-core/src/interfaces/learningrepository/).[`history`](/api/admin-core/src/interfaces/learningrepository/#history)

---

### page()

> **page**(`scope`, `after`, `limit`): `Promise`\<readonly [`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/)[]\>

#### Parameters

##### scope

[`LearningScope`](/api/admin-core/src/type-aliases/learningscope/)

##### after

`string` \| `undefined`

##### limit

`number`

#### Returns

`Promise`\<readonly [`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/)[]\>

#### Implementation of

[`LearningRepository`](/api/admin-core/src/interfaces/learningrepository/).[`page`](/api/admin-core/src/interfaces/learningrepository/#page)

---

### read()

> **read**(`scope`, `id`): `Promise`\<[`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/) \| `undefined`\>

#### Parameters

##### scope

[`LearningScope`](/api/admin-core/src/type-aliases/learningscope/)

##### id

`string`

#### Returns

`Promise`\<[`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/) \| `undefined`\>

#### Implementation of

[`LearningRepository`](/api/admin-core/src/interfaces/learningrepository/).[`read`](/api/admin-core/src/interfaces/learningrepository/#read)
