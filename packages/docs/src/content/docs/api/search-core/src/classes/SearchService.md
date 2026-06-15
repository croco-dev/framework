---
editUrl: false
next: false
prev: false
title: "SearchService"
---

tenant 격리를 자동 적용하는 상위 검색 서비스입니다.

## Constructors

### Constructor

> **new SearchService**(`deps`): `SearchService`

#### Parameters

##### deps

[`SearchServiceDependencies`](/api/search-core/src/type-aliases/searchservicedependencies/)

#### Returns

`SearchService`

## Methods

### bulkIndex()

> **bulkIndex**(`index`, `documents`): `Promise`\<`void`\>

#### Parameters

##### index

`string`

##### documents

`DocumentInput`[]

#### Returns

`Promise`\<`void`\>

***

### deleteDocument()

> **deleteDocument**(`index`, `documentId`): `Promise`\<`void`\>

#### Parameters

##### index

`string`

##### documentId

`string`

#### Returns

`Promise`\<`void`\>

***

### indexDocument()

> **indexDocument**(`index`, `document`): `Promise`\<`void`\>

#### Parameters

##### index

`string`

##### document

`DocumentInput`

#### Returns

`Promise`\<`void`\>

***

### search()

> **search**\<`T`\>(`index`, `query`): `Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### index

`string`

##### query

[`SearchQuery`](/api/search-core/src/type-aliases/searchquery/)

#### Returns

`Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>
