---
editUrl: false
next: false
prev: false
title: "SearchIndexQuery"
---

> **SearchIndexQuery**\<`TReference`\> = `Omit`\<[`SearchQuery`](/api/search-core/src/type-aliases/searchquery/), `"filters"` \| `"sort"`\> & `object`

타입 지정 검색 인덱스와 파생 질의에 사용하는 공개 타입입니다.

## Type Declaration

### filters?

> `readonly` `optional` **filters?**: `SearchIndexFilters`\<`TReference`\>

### sort?

> `readonly` `optional` **sort?**: \[`SearchIndexSortableField`\<`TReference`\>\] _extends_ \[`never`\] ? `never` : `object`[]

## Type Parameters

### TReference

`TReference` _extends_ [`SearchIndexRef`](/api/search-core/src/type-aliases/searchindexref/)
