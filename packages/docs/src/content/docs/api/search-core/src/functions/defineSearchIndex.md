---
editUrl: false
next: false
prev: false
title: "defineSearchIndex"
---

> **defineSearchIndex**\<`TDocument`\>(): `string` _extends_ keyof `TDocument` ? `never` : `SearchIndexFactory`\<`TDocument`\>

Defines one serializable search index while retaining its document and field contracts.

## Type Parameters

### TDocument

`TDocument` _extends_ `SearchIndexDocumentContract`

## Returns

`string` _extends_ keyof `TDocument` ? `never` : `SearchIndexFactory`\<`TDocument`\>
