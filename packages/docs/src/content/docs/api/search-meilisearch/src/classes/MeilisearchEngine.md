---
editUrl: false
next: false
prev: false
title: "MeilisearchEngine"
---

검색 엔진 추상 클래스

## Description

특정 검색 엔진 구현(Elasticsearch, OpenSearch, Typesense 등)의 추상화 계층입니다.
Token 기반 DI를 지원하며, 모든 구현체는 이 abstract class를 상속받아야 합니다.

## Extends

- [`SearchEngine`](/api/search-core/src/classes/searchengine/)

## Constructors

### Constructor

> **new MeilisearchEngine**(`options`): `MeilisearchEngine`

#### Parameters

##### options

[`MeilisearchEngineOptions`](/api/search-meilisearch/src/type-aliases/meilisearchengineoptions/)

#### Returns

`MeilisearchEngine`

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`constructor`](/api/search-core/src/classes/searchengine/#constructor)

## Properties

### capabilities

> `readonly` **capabilities**: [`SearchEngineCapabilities`](/api/search-core/src/type-aliases/searchenginecapabilities/)

검색 엔진 기능 플래그

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`capabilities`](/api/search-core/src/classes/searchengine/#capabilities)

---

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`SearchEngine`](/api/search-core/src/classes/searchengine/)\>

#### Inherited from

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`token`](/api/search-core/src/classes/searchengine/#token)

## Methods

### bulkIndex()

> **bulkIndex**(`indexName`, `documents`, `options?`): `Promise`\<`void`\>

대량 문서 인덱싱

#### Parameters

##### indexName

`string`

인덱스 이름

##### documents

[`SearchDocument`](/api/search-core/src/type-aliases/searchdocument/)[]

인덱싱할 문서 목록

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

> **createIndex**(`config`, `options?`): `Promise`\<`void`\>

인덱스 생성

#### Parameters

##### config

[`IndexConfig`](/api/search-core/src/type-aliases/indexconfig/)

인덱스 설정

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/) = `{}`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`createIndex`](/api/search-core/src/classes/searchengine/#createindex)

---

### deleteDocument()

> **deleteDocument**(`indexName`, `documentId`, `options?`): `Promise`\<`void`\>

문서 삭제

#### Parameters

##### indexName

`string`

인덱스 이름

##### documentId

`string`

문서 ID

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/) = `{}`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`deleteDocument`](/api/search-core/src/classes/searchengine/#deletedocument)

---

### deleteIndex()

> **deleteIndex**(`name`, `options?`): `Promise`\<`void`\>

인덱스 삭제

#### Parameters

##### name

`string`

인덱스 이름

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/) = `{}`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`deleteIndex`](/api/search-core/src/classes/searchengine/#deleteindex)

---

### generateTenantToken()

> **generateTenantToken**(`tenantId`, `expiresAt?`): `Promise`\<`string`\>

#### Parameters

##### tenantId

`string`

##### expiresAt?

`Date`

#### Returns

`Promise`\<`string`\>

---

### indexDocument()

> **indexDocument**(`indexName`, `document`, `options?`): `Promise`\<`void`\>

문서 인덱싱

#### Parameters

##### indexName

`string`

인덱스 이름

##### document

[`SearchDocument`](/api/search-core/src/type-aliases/searchdocument/)

인덱싱할 문서

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

> **search**\<`T`\>(`indexName`, `query`, `options?`): `Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>

검색 실행

#### Type Parameters

##### T

`T`

#### Parameters

##### indexName

`string`

인덱스 이름

##### query

[`SearchQuery`](/api/search-core/src/type-aliases/searchquery/)

검색 쿼리

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/) = `{}`

#### Returns

`Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>

검색 결과

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
