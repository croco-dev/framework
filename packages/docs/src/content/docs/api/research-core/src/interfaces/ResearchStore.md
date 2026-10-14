---
editUrl: false
next: false
prev: false
title: "ResearchStore"
---

## Methods

### read()

> **read**(`scope`, `studyId`): `Promise`\<[`ResearchRecord`](/api/research-core/src/type-aliases/researchrecord/)\>

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### studyId

`string`

#### Returns

`Promise`\<[`ResearchRecord`](/api/research-core/src/type-aliases/researchrecord/)\>

---

### transact()

> **transact**\<`T`\>(`scope`, `studyId`, `operation`): `Promise`\<`T`\>

Serialize and commit atomically per app/environment/tenant/study; rollback on rejection. No external dispatch inside.

#### Type Parameters

##### T

`T`

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### studyId

`string`

##### operation

(`record`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>
