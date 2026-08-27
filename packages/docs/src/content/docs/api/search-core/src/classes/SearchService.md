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

#### Call Signature

> **bulkIndex**\<`TReference`\>(`index`, `documents`): `Promise`\<`void`\>

##### Type Parameters

###### TReference

`TReference` _extends_ [`SearchIndexRef`](/api/search-core/src/type-aliases/searchindexref/)

##### Parameters

###### index

`TReference`

###### documents

[`SearchIndexDocumentInput`](/api/search-core/src/type-aliases/searchindexdocumentinput/)\<`TReference`\>[]

##### Returns

`Promise`\<`void`\>

#### Call Signature

> **bulkIndex**(`index`, `documents`): `Promise`\<`void`\>

##### Parameters

###### index

`string`

###### documents

`DocumentInput`[]

##### Returns

`Promise`\<`void`\>

---

### deleteDocument()

#### Call Signature

> **deleteDocument**(`index`, `documentId`): `Promise`\<`void`\>

##### Parameters

###### index

[`SearchIndexRef`](/api/search-core/src/type-aliases/searchindexref/)

###### documentId

`string`

##### Returns

`Promise`\<`void`\>

#### Call Signature

> **deleteDocument**(`index`, `documentId`): `Promise`\<`void`\>

##### Parameters

###### index

`string`

###### documentId

`string`

##### Returns

`Promise`\<`void`\>

---

### indexDocument()

#### Call Signature

> **indexDocument**\<`TReference`\>(`index`, `document`): `Promise`\<`void`\>

##### Type Parameters

###### TReference

`TReference` _extends_ [`SearchIndexRef`](/api/search-core/src/type-aliases/searchindexref/)

##### Parameters

###### index

`TReference`

###### document

[`SearchIndexDocumentInput`](/api/search-core/src/type-aliases/searchindexdocumentinput/)\<`TReference`\>

##### Returns

`Promise`\<`void`\>

#### Call Signature

> **indexDocument**(`index`, `document`): `Promise`\<`void`\>

##### Parameters

###### index

`string`

###### document

`DocumentInput`

##### Returns

`Promise`\<`void`\>

---

### search()

#### Call Signature

> **search**\<`TReference`, `TQuery`\>(`index`, `query`): `Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<[`SearchIndexDocument`](/api/search-core/src/type-aliases/searchindexdocument/)\<`TReference`\>\>\>

##### Type Parameters

###### TReference

`TReference` _extends_ [`SearchIndexRef`](/api/search-core/src/type-aliases/searchindexref/)

###### TQuery

`TQuery` _extends_ [`SearchIndexQuery`](/api/search-core/src/type-aliases/searchindexquery/)\<`NoInfer`\<`TReference`\>\>

##### Parameters

###### index

`TReference`

###### query

`TQuery` & `SearchIndexQueryInput`\<`TReference`, `TQuery`\>

##### Returns

`Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<[`SearchIndexDocument`](/api/search-core/src/type-aliases/searchindexdocument/)\<`TReference`\>\>\>

#### Call Signature

> **search**\<`T`\>(`index`, `query`): `Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>

##### Type Parameters

###### T

`T`

##### Parameters

###### index

`string`

###### query

[`SearchQuery`](/api/search-core/src/type-aliases/searchquery/)

##### Returns

`Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>
