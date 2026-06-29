---
editUrl: false
next: false
prev: false
title: "ListExecutionsOptions"
---

List options for querying executions.

## Properties

### limit?

> `optional` **limit?**: `number`

Limit results

***

### offset?

> `optional` **offset?**: `number`

Offset for pagination

***

### parentId?

> `optional` **parentId?**: `string`

Filter by parent ID

***

### replayOf?

> `optional` **replayOf?**: `string` \| `null`

Filter by original execution ID when listing replay executions

***

### status?

> `optional` **status?**: [`ExecutionStatus`](/api/execution-core/src/type-aliases/executionstatus/)

Filter by status

***

### type?

> `optional` **type?**: `string`

Filter by type
