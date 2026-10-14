---
editUrl: false
next: false
prev: false
title: "DrizzleResearchStore"
---

## Implements

- [`ResearchStore`](/api/research-core/src/interfaces/researchstore/)

## Constructors

### Constructor

> **new DrizzleResearchStore**(`db`): `DrizzleResearchStore`

#### Parameters

##### db

[`DrizzleResearchClient`](/api/research-drizzle/src/type-aliases/drizzleresearchclient/)

#### Returns

`DrizzleResearchStore`

## Methods

### read()

> **read**(`scope`, `id`): `Promise`\<[`ResearchRecord`](/api/research-core/src/type-aliases/researchrecord/)\>

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### id

`string`

#### Returns

`Promise`\<[`ResearchRecord`](/api/research-core/src/type-aliases/researchrecord/)\>

#### Implementation of

[`ResearchStore`](/api/research-core/src/interfaces/researchstore/).[`read`](/api/research-core/src/interfaces/researchstore/#read)

---

### transact()

> **transact**\<`T`\>(`scope`, `id`, `operation`): `Promise`\<`T`\>

Serialize and commit atomically per app/environment/tenant/study; rollback on rejection. No external dispatch inside.

#### Type Parameters

##### T

`T`

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### id

`string`

##### operation

(`record`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

#### Implementation of

[`ResearchStore`](/api/research-core/src/interfaces/researchstore/).[`transact`](/api/research-core/src/interfaces/researchstore/#transact)
