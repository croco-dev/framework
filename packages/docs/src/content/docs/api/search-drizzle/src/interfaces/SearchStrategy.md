---
editUrl: false
next: false
prev: false
title: "SearchStrategy"
---

PostgreSQL 검색 전략이 구현해야 하는 계약입니다.

## Methods

### buildBulkIndexQueryPlans()?

> `optional` **buildBulkIndexQueryPlans**(`table`, `documents`, `tenantId`): readonly [`BulkIndexQueryPlan`](/api/search-drizzle/src/type-aliases/bulkindexqueryplan/)[]

지원되는 전략에서 여러 문서를 bounded SQL chunk로 컴파일합니다.

#### Parameters

##### table

`string`

##### documents

readonly [`SearchDocument`](/api/search-core/src/type-aliases/searchdocument/)[]

##### tenantId

`string`

#### Returns

readonly [`BulkIndexQueryPlan`](/api/search-drizzle/src/type-aliases/bulkindexqueryplan/)[]

---

### buildDeleteQuery()

> **buildDeleteQuery**(`table`, `documentId`, `tenantId`): `SQL`

문서 삭제 SQL을 생성합니다.

#### Parameters

##### table

`string`

##### documentId

`string`

##### tenantId

`string`

#### Returns

`SQL`

---

### buildIndexQuery()

> **buildIndexQuery**(`table`, `document`, `tenantId`): `SQL`

문서 색인 SQL을 생성합니다.

#### Parameters

##### table

`string`

##### document

[`SearchDocument`](/api/search-core/src/type-aliases/searchdocument/)

##### tenantId

`string`

#### Returns

`SQL`

---

### buildSearchQuery()

> **buildSearchQuery**(`table`, `query`, `tenantId`): [`SearchQueryPlan`](/api/search-drizzle/src/type-aliases/searchqueryplan/)

검색 SQL을 생성합니다.

#### Parameters

##### table

`string`

##### query

[`SearchQuery`](/api/search-core/src/type-aliases/searchquery/)

##### tenantId

`string`

#### Returns

[`SearchQueryPlan`](/api/search-drizzle/src/type-aliases/searchqueryplan/)

---

### checkCapability()

> **checkCapability**(`db`): `Promise`\<`boolean`\>

현재 DB가 전략을 지원하는지 확인합니다.

#### Parameters

##### db

[`DrizzleSearchDatabase`](/api/search-drizzle/src/type-aliases/drizzlesearchdatabase/)

#### Returns

`Promise`\<`boolean`\>

---

### getCapabilities()

> **getCapabilities**(): [`SearchEngineCapabilities`](/api/search-core/src/type-aliases/searchenginecapabilities/)

전략이 제공하는 검색 기능을 반환합니다.

#### Returns

[`SearchEngineCapabilities`](/api/search-core/src/type-aliases/searchenginecapabilities/)

---

### getRequiredExtensions()

> **getRequiredExtensions**(): `string`[]

전략 실행에 필요한 PostgreSQL 확장 목록을 반환합니다.

#### Returns

`string`[]

---

### mapSearchRow()?

> `optional` **mapSearchRow**\<`T`\>(`row`): `T`

검색 결과 행을 도메인 문서 타입으로 변환합니다.

#### Type Parameters

##### T

`T`

#### Parameters

##### row

[`SearchResultRow`](/api/search-drizzle/src/type-aliases/searchresultrow/)

#### Returns

`T`
