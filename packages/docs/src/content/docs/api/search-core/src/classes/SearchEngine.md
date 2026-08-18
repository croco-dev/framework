---
editUrl: false
next: false
prev: false
title: "SearchEngine"
---

검색 엔진 추상 클래스

## Description

특정 검색 엔진 구현(Elasticsearch, OpenSearch, Typesense 등)의 추상화 계층입니다.
Token 기반 DI를 지원하며, 모든 구현체는 이 abstract class를 상속받아야 합니다.

## Extended by

- [`DrizzleSearchEngine`](/api/search-drizzle/src/classes/drizzlesearchengine/)
- [`MeilisearchEngine`](/api/search-meilisearch/src/classes/meilisearchengine/)

## Constructors

### Constructor

> **new SearchEngine**(): `SearchEngine`

#### Returns

`SearchEngine`

## Properties

### capabilities

> `abstract` `readonly` **capabilities**: [`SearchEngineCapabilities`](/api/search-core/src/type-aliases/searchenginecapabilities/)

검색 엔진 기능 플래그

***

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`SearchEngine`\>

## Methods

### bulkIndex()

> `abstract` **bulkIndex**(`index`, `documents`): `Promise`\<`void`\>

대량 문서 인덱싱

#### Parameters

##### index

`string`

인덱스 이름

##### documents

[`SearchDocument`](/api/search-core/src/type-aliases/searchdocument/)[]

인덱싱할 문서 목록

#### Returns

`Promise`\<`void`\>

***

### createIndex()

> `abstract` **createIndex**(`config`): `Promise`\<`void`\>

인덱스 생성

#### Parameters

##### config

[`IndexConfig`](/api/search-core/src/type-aliases/indexconfig/)

인덱스 설정

#### Returns

`Promise`\<`void`\>

***

### deleteDocument()

> `abstract` **deleteDocument**(`index`, `documentId`): `Promise`\<`void`\>

문서 삭제

#### Parameters

##### index

`string`

인덱스 이름

##### documentId

`string`

문서 ID

#### Returns

`Promise`\<`void`\>

***

### deleteIndex()

> `abstract` **deleteIndex**(`name`): `Promise`\<`void`\>

인덱스 삭제

#### Parameters

##### name

`string`

인덱스 이름

#### Returns

`Promise`\<`void`\>

***

### indexDocument()

> `abstract` **indexDocument**(`index`, `document`): `Promise`\<`void`\>

문서 인덱싱

#### Parameters

##### index

`string`

인덱스 이름

##### document

[`SearchDocument`](/api/search-core/src/type-aliases/searchdocument/)

인덱싱할 문서

#### Returns

`Promise`\<`void`\>

***

### search()

> `abstract` **search**\<`T`\>(`index`, `query`): `Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>

검색 실행

#### Type Parameters

##### T

`T`

#### Parameters

##### index

`string`

인덱스 이름

##### query

[`SearchQuery`](/api/search-core/src/type-aliases/searchquery/)

검색 쿼리

#### Returns

`Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>

검색 결과
