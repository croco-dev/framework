---
editUrl: false
next: false
prev: false
title: "SearchIndexRef"
---

> **SearchIndexRef**\<`TDocument`, `TName`, `TSearchableFields`, `TFilterableFields`, `TSortableFields`\> = `object`

타입 지정 검색 인덱스와 파생 질의에 사용하는 공개 타입입니다.

## Type Parameters

### TDocument

`TDocument` _extends_ `SearchIndexDocumentContract` = `SearchIndexDocumentContract`

### TName

`TName` _extends_ `string` = `string`

### TSearchableFields

`TSearchableFields` _extends_ readonly `string`[] = readonly `string`[]

### TFilterableFields

`TFilterableFields` _extends_ readonly `string`[] = readonly `string`[]

### TSortableFields

`TSortableFields` _extends_ readonly `string`[] = readonly `string`[]

## Properties

### \[SEARCH_INDEX_REF_CONTRACT\]

> `readonly` **\[SEARCH_INDEX_REF_CONTRACT\]**: `object`

#### document

> `readonly` **document**: `TDocument`

#### filterableField

> `readonly` **filterableField**: `TFilterableFields`\[`number`\]

#### searchableField

> `readonly` **searchableField**: `TSearchableFields`\[`number`\]

#### sortableField

> `readonly` **sortableField**: `TSortableFields`\[`number`\]

---

### filterableFields?

> `readonly` `optional` **filterableFields?**: `TFilterableFields`

---

### name

> `readonly` **name**: `TName`

---

### primaryKey?

> `readonly` `optional` **primaryKey?**: `string`

---

### searchableFields?

> `readonly` `optional` **searchableFields?**: `TSearchableFields`

---

### sortableFields?

> `readonly` `optional` **sortableFields?**: `TSortableFields`
