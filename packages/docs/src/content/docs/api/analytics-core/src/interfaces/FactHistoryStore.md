---
editUrl: false
next: false
prev: false
title: "FactHistoryStore"
---

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

---

### getRevision()

> **getRevision**(`scope`): `Promise`\<`number`\>

#### Parameters

##### scope

[`FactScope`](/api/analytics-core/src/type-aliases/factscope/)

#### Returns

`Promise`\<`number`\>

---

### readHistory()

> **readHistory**(`input`): `Promise`\<readonly [`FactRow`](/api/analytics-core/src/type-aliases/factrow/)[]\>

#### Parameters

##### input

[`FactHistoryQuery`](/api/analytics-core/src/type-aliases/facthistoryquery/)

#### Returns

`Promise`\<readonly [`FactRow`](/api/analytics-core/src/type-aliases/factrow/)[]\>
