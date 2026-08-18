---
editUrl: false
next: false
prev: false
title: "AdminDataTableListResult"
---

> **AdminDataTableListResult**\<`TData`\> = `object`

## Type Parameters

### TData

`TData`

## Properties

### pagination?

> `readonly` `optional` **pagination?**: [`AdminDataTablePaginationSummary`](/api/admin-react/src/type-aliases/admindatatablepaginationsummary/)

---

### problem?

> `readonly` `optional` **problem?**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

---

### rows

> `readonly` **rows**: readonly `TData`[]

---

### search?

> `readonly` `optional` **search?**: [`SearchQuery`](/api/search-core/src/type-aliases/searchquery/)

---

### source

> `readonly` **source**: [`AdminDataTableListSource`](/api/admin-react/src/type-aliases/admindatatablelistsource/)

---

### total?

> `readonly` `optional` **total?**: `number`
