---
editUrl: false
next: false
prev: false
title: "SearchIndexDefinition"
---

> **SearchIndexDefinition**\<`TDocument`, `TName`, `TSearchableFields`, `TFilterableFields`, `TSortableFields`\> = `object`

타입 지정 검색 인덱스와 파생 질의에 사용하는 공개 타입입니다.

## Type Parameters

### TDocument

`TDocument` _extends_ `SearchIndexDocumentContract`

### TName

`TName` _extends_ `string`

### TSearchableFields

`TSearchableFields` _extends_ readonly [`SearchIndexField`](/api/search-core/src/type-aliases/searchindexfield/)\<`TDocument`\>[]

### TFilterableFields

`TFilterableFields` _extends_ readonly [`SearchIndexField`](/api/search-core/src/type-aliases/searchindexfield/)\<`TDocument`\>[]

### TSortableFields

`TSortableFields` _extends_ readonly [`SearchIndexField`](/api/search-core/src/type-aliases/searchindexfield/)\<`TDocument`\>[]

## Properties

### filterableFields?

> `readonly` `optional` **filterableFields?**: `TFilterableFields`

---

### name

> `readonly` **name**: `TName`

---

### primaryKey?

> `readonly` `optional` **primaryKey?**: [`SearchIndexField`](/api/search-core/src/type-aliases/searchindexfield/)\<`TDocument`\>

---

### searchableFields?

> `readonly` `optional` **searchableFields?**: `TSearchableFields`

---

### sortableFields?

> `readonly` `optional` **sortableFields?**: `TSortableFields`
