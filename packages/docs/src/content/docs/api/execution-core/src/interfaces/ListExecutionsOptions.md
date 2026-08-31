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

Maximum number of results to return.

Callers that require a complete result set must paginate with `limit` and `offset` because
store implementations may apply a documented default when this value is omitted.

---

### offset?

> `optional` **offset?**: `number`

Zero-based offset for pagination. Defaults to the first result.

---

### parentId?

> `optional` **parentId?**: `string`

Filter by parent ID

---

### replayOf?

> `optional` **replayOf?**: `string` \| `null`

Filter by original execution ID when listing replay executions

---

### status?

> `optional` **status?**: [`ExecutionStatus`](/api/execution-core/src/type-aliases/executionstatus/)

Filter by status

---

### type?

> `optional` **type?**: `string`

Filter by type
