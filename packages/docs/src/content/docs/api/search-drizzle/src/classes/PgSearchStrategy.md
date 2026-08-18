---
editUrl: false
next: false
prev: false
title: "PgSearchStrategy"
---

`pg_search` 확장을 이용한 전문 검색 전략입니다.

## Implements

- [`SearchStrategy`](/api/search-drizzle/src/interfaces/searchstrategy/)

## Constructors

### Constructor

> **new PgSearchStrategy**(`options?`): `PgSearchStrategy`

선택적 인덱스 이름 설정으로 전략을 초기화합니다.

#### Parameters

##### options?

###### indexName?

`string`

#### Returns

`PgSearchStrategy`

## Methods

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

#### Implementation of

[`SearchStrategy`](/api/search-drizzle/src/interfaces/searchstrategy/).[`buildDeleteQuery`](/api/search-drizzle/src/interfaces/searchstrategy/#builddeletequery)

---

### buildIndexQuery()

> **buildIndexQuery**(`table`, `document`, `tenantId`): `SQL`

문서를 테이블에 삽입하는 SQL을 생성합니다.

#### Parameters

##### table

`string`

##### document

[`SearchDocument`](/api/search-core/src/type-aliases/searchdocument/)

##### tenantId

`string`

#### Returns

`SQL`

#### Implementation of

[`SearchStrategy`](/api/search-drizzle/src/interfaces/searchstrategy/).[`buildIndexQuery`](/api/search-drizzle/src/interfaces/searchstrategy/#buildindexquery)

---

### buildSearchQuery()

> **buildSearchQuery**(`table`, `query`, `tenantId`): `SQL`

`pg_search` 문법을 사용하는 검색 SQL을 생성합니다.

#### Parameters

##### table

`string`

##### query

[`SearchQuery`](/api/search-core/src/type-aliases/searchquery/)

##### tenantId

`string`

#### Returns

`SQL`

#### Implementation of

[`SearchStrategy`](/api/search-drizzle/src/interfaces/searchstrategy/).[`buildSearchQuery`](/api/search-drizzle/src/interfaces/searchstrategy/#buildsearchquery)

---

### checkCapability()

> **checkCapability**(`db`): `Promise`\<`boolean`\>

현재 DB가 `pg_search` 확장을 지원하는지 확인합니다.

#### Parameters

##### db

`NodePgDatabase`\<`Record`\<`string`, `never`\>\>

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`SearchStrategy`](/api/search-drizzle/src/interfaces/searchstrategy/).[`checkCapability`](/api/search-drizzle/src/interfaces/searchstrategy/#checkcapability)

---

### getCapabilities()

> **getCapabilities**(): [`SearchEngineCapabilities`](/api/search-core/src/type-aliases/searchenginecapabilities/)

이 전략이 제공하는 검색 기능을 반환합니다.

#### Returns

[`SearchEngineCapabilities`](/api/search-core/src/type-aliases/searchenginecapabilities/)

#### Implementation of

[`SearchStrategy`](/api/search-drizzle/src/interfaces/searchstrategy/).[`getCapabilities`](/api/search-drizzle/src/interfaces/searchstrategy/#getcapabilities)

---

### getRequiredExtensions()

> **getRequiredExtensions**(): `string`[]

전략에 필요한 PostgreSQL 확장 목록을 반환합니다.

#### Returns

`string`[]

#### Implementation of

[`SearchStrategy`](/api/search-drizzle/src/interfaces/searchstrategy/).[`getRequiredExtensions`](/api/search-drizzle/src/interfaces/searchstrategy/#getrequiredextensions)
