---
editUrl: false
next: false
prev: false
title: "DrizzleSearchEngine"
---

PostgreSQL 검색 전략을 사용해 문서 검색을 수행하는 Drizzle 검색 엔진입니다.

## Extends

- [`SearchEngine`](/api/search-core/src/classes/searchengine/)

## Constructors

### Constructor

> **new DrizzleSearchEngine**(`db`, `strategy`): `DrizzleSearchEngine`

Drizzle DB와 검색 전략을 받아 검색 엔진을 초기화합니다.

#### Parameters

##### db

[`DrizzleSearchDatabase`](/api/search-drizzle/src/type-aliases/drizzlesearchdatabase/)

##### strategy

[`SearchStrategy`](/api/search-drizzle/src/interfaces/searchstrategy/)

#### Returns

`DrizzleSearchEngine`

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`constructor`](/api/search-core/src/classes/searchengine/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`SearchEngine`](/api/search-core/src/classes/searchengine/)\>

#### Inherited from

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`token`](/api/search-core/src/classes/searchengine/#token)

## Accessors

### capabilities

#### Get Signature

> **get** **capabilities**(): [`SearchEngineCapabilities`](/api/search-core/src/type-aliases/searchenginecapabilities/)

현재 전략이 제공하는 검색 기능을 반환합니다.

##### Returns

[`SearchEngineCapabilities`](/api/search-core/src/type-aliases/searchenginecapabilities/)

검색 엔진 기능 플래그

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`capabilities`](/api/search-core/src/classes/searchengine/#capabilities)

## Methods

### bulkIndex()

> **bulkIndex**(`index`, `documents`, `options?`): `Promise`\<`void`\>

여러 문서를 bounded SQL chunk로 인덱싱합니다.

#### Parameters

##### index

`string`

##### documents

[`SearchDocument`](/api/search-core/src/type-aliases/searchdocument/)[]

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/) = `{}`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`bulkIndex`](/api/search-core/src/classes/searchengine/#bulkindex)

---

### bulkIndexAt()

> **bulkIndexAt**\<`TReference`\>(`index`, `documents`, `options?`): `Promise`\<`void`\>

타입이 지정된 인덱스 참조에 여러 문서를 인덱싱합니다.

#### Type Parameters

##### TReference

`TReference` _extends_ [`SearchIndexRef`](/api/search-core/src/type-aliases/searchindexref/)

#### Parameters

##### index

`TReference`

##### documents

readonly [`SearchIndexDocument`](/api/search-core/src/type-aliases/searchindexdocument/)\<`TReference`\>[]

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/)

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`bulkIndexAt`](/api/search-core/src/classes/searchengine/#bulkindexat)

---

### createIndex()

> **createIndex**(`_config`, `options?`): `Promise`\<`void`\>

Drizzle 검색 엔진에서 지원하지 않는 인덱스 생성 API입니다.

#### Parameters

##### \_config

[`IndexConfig`](/api/search-core/src/type-aliases/indexconfig/)

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/) = `{}`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`createIndex`](/api/search-core/src/classes/searchengine/#createindex)

---

### deleteDocument()

> **deleteDocument**(`index`, `documentId`, `options?`): `Promise`\<`void`\>

문서 ID로 인덱스에서 문서를 삭제합니다.

#### Parameters

##### index

`string`

##### documentId

`string`

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/) = `{}`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`deleteDocument`](/api/search-core/src/classes/searchengine/#deletedocument)

---

### deleteIndex()

> **deleteIndex**(`_name`, `options?`): `Promise`\<`void`\>

Drizzle 검색 엔진에서 지원하지 않는 인덱스 삭제 API입니다.

#### Parameters

##### \_name

`string`

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/) = `{}`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`deleteIndex`](/api/search-core/src/classes/searchengine/#deleteindex)

---

### indexDocument()

> **indexDocument**(`index`, `document`, `options?`): `Promise`\<`void`\>

단일 문서를 인덱스에 저장합니다.

#### Parameters

##### index

`string`

##### document

[`SearchDocument`](/api/search-core/src/type-aliases/searchdocument/)

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/) = `{}`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`indexDocument`](/api/search-core/src/classes/searchengine/#indexdocument)

---

### indexDocumentAt()

> **indexDocumentAt**\<`TReference`\>(`index`, `document`, `options?`): `Promise`\<`void`\>

타입이 지정된 인덱스 참조에 문서를 인덱싱합니다.

#### Type Parameters

##### TReference

`TReference` _extends_ [`SearchIndexRef`](/api/search-core/src/type-aliases/searchindexref/)

#### Parameters

##### index

`TReference`

##### document

[`SearchIndexDocument`](/api/search-core/src/type-aliases/searchindexdocument/)\<`TReference`\>

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/)

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`indexDocumentAt`](/api/search-core/src/classes/searchengine/#indexdocumentat)

---

### search()

> **search**\<`T`\>(`index`, `query`, `options?`): `Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>

인덱스와 쿼리를 받아 검색 결과를 반환합니다.

#### Type Parameters

##### T

`T`

#### Parameters

##### index

`string`

##### query

[`SearchQuery`](/api/search-core/src/type-aliases/searchquery/)

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/) = `{}`

#### Returns

`Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`search`](/api/search-core/src/classes/searchengine/#search)

---

### searchIndex()

> **searchIndex**\<`TReference`, `TQuery`\>(`index`, `query`, `options?`): `Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<[`SearchIndexDocument`](/api/search-core/src/type-aliases/searchindexdocument/)\<`TReference`\>\>\>

타입이 지정된 인덱스 참조로 검색을 실행합니다.

#### Type Parameters

##### TReference

`TReference` _extends_ [`SearchIndexRef`](/api/search-core/src/type-aliases/searchindexref/)

##### TQuery

`TQuery` _extends_ [`SearchIndexQuery`](/api/search-core/src/type-aliases/searchindexquery/)\<`NoInfer`\<`TReference`\>\>

#### Parameters

##### index

`TReference`

##### query

`TQuery` & `SearchIndexQueryInput`\<`TReference`, `TQuery`\>

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/)

#### Returns

`Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<[`SearchIndexDocument`](/api/search-core/src/type-aliases/searchindexdocument/)\<`TReference`\>\>\>

#### Inherited from

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`searchIndex`](/api/search-core/src/classes/searchengine/#searchindex)
