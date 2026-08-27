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

> **bulkIndex**\<`TReference`\>(`index`, `documents`, `options?`): `Promise`\<`void`\>

##### Type Parameters

###### TReference

`TReference` _extends_ [`SearchIndexRef`](/api/search-core/src/type-aliases/searchindexref/)

##### Parameters

###### index

`TReference`

###### documents

[`SearchIndexDocumentInput`](/api/search-core/src/type-aliases/searchindexdocumentinput/)\<`TReference`\>[]

###### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/)

##### Returns

`Promise`\<`void`\>

#### Call Signature

> **bulkIndex**(`index`, `documents`, `options?`): `Promise`\<`void`\>

##### Parameters

###### index

`string`

###### documents

`DocumentInput`[]

###### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/)

##### Returns

`Promise`\<`void`\>

---

### createIndex()

> **createIndex**(`config`, `options?`): `Promise`\<`void`\>

#### Parameters

##### config

[`IndexConfig`](/api/search-core/src/type-aliases/indexconfig/)

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/) = `{}`

#### Returns

`Promise`\<`void`\>

---

### deleteDocument()

#### Call Signature

> **deleteDocument**(`index`, `documentId`, `options?`): `Promise`\<`void`\>

##### Parameters

###### index

[`SearchIndexRef`](/api/search-core/src/type-aliases/searchindexref/)

###### documentId

`string`

###### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/)

##### Returns

`Promise`\<`void`\>

#### Call Signature

> **deleteDocument**(`index`, `documentId`, `options?`): `Promise`\<`void`\>

##### Parameters

###### index

`string`

###### documentId

`string`

###### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/)

##### Returns

`Promise`\<`void`\>

---

### deleteIndex()

> **deleteIndex**(`name`, `options?`): `Promise`\<`void`\>

#### Parameters

##### name

`string`

##### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/) = `{}`

#### Returns

`Promise`\<`void`\>

---

### indexDocument()

#### Call Signature

> **indexDocument**\<`TReference`\>(`index`, `document`, `options?`): `Promise`\<`void`\>

##### Type Parameters

###### TReference

`TReference` _extends_ [`SearchIndexRef`](/api/search-core/src/type-aliases/searchindexref/)

##### Parameters

###### index

`TReference`

###### document

[`SearchIndexDocumentInput`](/api/search-core/src/type-aliases/searchindexdocumentinput/)\<`TReference`\>

###### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/)

##### Returns

`Promise`\<`void`\>

#### Call Signature

> **indexDocument**(`index`, `document`, `options?`): `Promise`\<`void`\>

##### Parameters

###### index

`string`

###### document

`DocumentInput`

###### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/)

##### Returns

`Promise`\<`void`\>

---

### search()

#### Call Signature

> **search**\<`TReference`, `TQuery`\>(`index`, `query`, `options?`): `Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<[`SearchIndexDocument`](/api/search-core/src/type-aliases/searchindexdocument/)\<`TReference`\>\>\>

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

###### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/)

##### Returns

`Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<[`SearchIndexDocument`](/api/search-core/src/type-aliases/searchindexdocument/)\<`TReference`\>\>\>

#### Call Signature

> **search**\<`T`\>(`index`, `query`, `options?`): `Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>

##### Type Parameters

###### T

`T`

##### Parameters

###### index

`string`

###### query

[`SearchQuery`](/api/search-core/src/type-aliases/searchquery/)

###### options?

[`SearchOperationOptions`](/api/search-core/src/type-aliases/searchoperationoptions/)

##### Returns

`Promise`\<[`SearchResult`](/api/search-core/src/type-aliases/searchresult/)\<`T`\>\>
