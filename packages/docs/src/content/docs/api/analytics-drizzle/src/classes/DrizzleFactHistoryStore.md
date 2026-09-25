---
editUrl: false
next: false
prev: false
title: "DrizzleFactHistoryStore"
---

PostgreSQL atomic receipt + projection persistence. All scope mutations share a row lock.

## Implements

- [`FactHistoryStore`](/api/analytics-core/src/interfaces/facthistorystore/)

## Constructors

### Constructor

> **new DrizzleFactHistoryStore**(`db`): `DrizzleFactHistoryStore`

#### Parameters

##### db

[`FactHistoryDatabase`](/api/analytics-drizzle/src/interfaces/facthistorydatabase/)

#### Returns

`DrizzleFactHistoryStore`

## Methods

### appendFacts()

> **appendFacts**(`input`, `recordedAt`): `Promise`\<[`AppendFactsResult`](/api/analytics-core/src/type-aliases/appendfactsresult/)\>

#### Parameters

##### input

[`AppendFactsInput`](/api/analytics-core/src/type-aliases/appendfactsinput/)

##### recordedAt

`string`

#### Returns

`Promise`\<[`AppendFactsResult`](/api/analytics-core/src/type-aliases/appendfactsresult/)\>

#### Implementation of

[`FactHistoryStore`](/api/analytics-core/src/interfaces/facthistorystore/).[`appendFacts`](/api/analytics-core/src/interfaces/facthistorystore/#appendfacts)

---

### deleteSubject()

> **deleteSubject**(`scope`, `subject`): `Promise`\<`void`\>

#### Parameters

##### scope

[`FactScope`](/api/analytics-core/src/type-aliases/factscope/)

##### subject

[`FactSubject`](/api/analytics-core/src/type-aliases/factsubject/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`FactHistoryStore`](/api/analytics-core/src/interfaces/facthistorystore/).[`deleteSubject`](/api/analytics-core/src/interfaces/facthistorystore/#deletesubject)

---

### getRevision()

> **getRevision**(`scope`): `Promise`\<`number`\>

#### Parameters

##### scope

[`FactScope`](/api/analytics-core/src/type-aliases/factscope/)

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`FactHistoryStore`](/api/analytics-core/src/interfaces/facthistorystore/).[`getRevision`](/api/analytics-core/src/interfaces/facthistorystore/#getrevision)

---

### readHistory()

> **readHistory**(`input`): `Promise`\<readonly [`FactRow`](/api/analytics-core/src/type-aliases/factrow/)[]\>

#### Parameters

##### input

[`FactHistoryQuery`](/api/analytics-core/src/type-aliases/facthistoryquery/)

#### Returns

`Promise`\<readonly [`FactRow`](/api/analytics-core/src/type-aliases/factrow/)[]\>

#### Implementation of

[`FactHistoryStore`](/api/analytics-core/src/interfaces/facthistorystore/).[`readHistory`](/api/analytics-core/src/interfaces/facthistorystore/#readhistory)
