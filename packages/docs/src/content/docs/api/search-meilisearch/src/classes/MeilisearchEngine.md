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

> **bulkIndex**(`indexName`, `documents`): `Promise`\<`void`\>

대량 문서 인덱싱

#### Parameters

##### indexName

`string`

##### documents

[`SearchDocument`](/api/search-core/src/type-aliases/searchdocument/)[]

인덱싱할 문서 목록

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`bulkIndex`](/api/search-core/src/classes/searchengine/#bulkindex)

---

### createIndex()

> **createIndex**(`config`): `Promise`\<`void`\>

인덱스 생성

#### Parameters

##### config

[`IndexConfig`](/api/search-core/src/type-aliases/indexconfig/)

인덱스 설정

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`createIndex`](/api/search-core/src/classes/searchengine/#createindex)

---

### deleteDocument()

> **deleteDocument**(`indexName`, `documentId`): `Promise`\<`void`\>

문서 삭제

#### Parameters

##### indexName

`string`

##### documentId

`string`

문서 ID

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`deleteDocument`](/api/search-core/src/classes/searchengine/#deletedocument)

---

### deleteIndex()

> **deleteIndex**(`name`): `Promise`\<`void`\>

인덱스 삭제

#### Parameters

##### name

`string`

인덱스 이름

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

> **indexDocument**(`indexName`, `document`): `Promise`\<`void`\>

문서 인덱싱

#### Parameters

##### indexName

`string`

##### document

[`SearchDocument`](/api/search-core/src/type-aliases/searchdocument/)

인덱싱할 문서

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`indexDocument`](/api/search-core/src/classes/searchengine/#indexdocument)

---

### search()

> **search**\<`T`\>(`indexName`, `query`): `Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>

검색 실행

#### Type Parameters

##### T

`T`

#### Parameters

##### indexName

`string`

##### query

[`SearchQuery`](/api/search-core/src/type-aliases/searchquery/)

검색 쿼리

#### Returns

`Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>

검색 결과

#### Overrides

[`SearchEngine`](/api/search-core/src/classes/searchengine/).[`search`](/api/search-core/src/classes/searchengine/#search)
