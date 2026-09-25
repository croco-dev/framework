---
editUrl: false
next: false
prev: false
title: "FactHistoryService"
---

## Constructors

### Constructor

> **new FactHistoryService**(`store`, `definitions`, `policy`, `clock?`): `FactHistoryService`

#### Parameters

##### store

[`FactHistoryStore`](/api/analytics-core/src/interfaces/facthistorystore/)

##### definitions

readonly [`FactDefinition`](/api/analytics-core/src/type-aliases/factdefinition/)[]

##### policy

[`FactHistoryPolicy`](/api/analytics-core/src/type-aliases/facthistorypolicy/)

##### clock?

() => `Date`

#### Returns

`FactHistoryService`

## Methods

### appendFact()

> **appendFact**(`input`): `Promise`\<[`AppendFactsResult`](/api/analytics-core/src/type-aliases/appendfactsresult/)\>

#### Parameters

##### input

`Omit`\<[`AppendFactsInput`](/api/analytics-core/src/type-aliases/appendfactsinput/), `"rows"`\> & `object`

#### Returns

`Promise`\<[`AppendFactsResult`](/api/analytics-core/src/type-aliases/appendfactsresult/)\>

---

### appendFacts()

> **appendFacts**(`input`): `Promise`\<[`AppendFactsResult`](/api/analytics-core/src/type-aliases/appendfactsresult/)\>

#### Parameters

##### input

[`AppendFactsInput`](/api/analytics-core/src/type-aliases/appendfactsinput/)

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

> **getRevision**(`input`): `Promise`\<`number`\>

#### Parameters

##### input

`Pick`\<[`ReadFactsAtInput`](/api/analytics-core/src/type-aliases/readfactsatinput/), `"scope"` \| `"subject"` \| `"definitionId"` \| `"definitionVersion"`\>

#### Returns

`Promise`\<`number`\>

---

### readFactsAt()

> **readFactsAt**(`input`): `Promise`\<[`FactReadResult`](/api/analytics-core/src/type-aliases/factreadresult/)\>

#### Parameters

##### input

[`ReadFactsAtInput`](/api/analytics-core/src/type-aliases/readfactsatinput/)

#### Returns

`Promise`\<[`FactReadResult`](/api/analytics-core/src/type-aliases/factreadresult/)\>

---

### readHistory()

> **readHistory**(`input`): `Promise`\<readonly [`FactRow`](/api/analytics-core/src/type-aliases/factrow/)[]\>

#### Parameters

##### input

`Omit`\<[`FactHistoryQuery`](/api/analytics-core/src/type-aliases/facthistoryquery/), `"knownAt"`\> & `object`

#### Returns

`Promise`\<readonly [`FactRow`](/api/analytics-core/src/type-aliases/factrow/)[]\>
