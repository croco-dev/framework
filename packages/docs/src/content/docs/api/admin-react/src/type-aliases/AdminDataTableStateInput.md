---
editUrl: false
next: false
prev: false
title: "AdminDataTableStateInput"
---

> **AdminDataTableStateInput**\<`TData`\> = `object`

## Type Parameters

### TData

`TData`

## Properties

### filters?

> `readonly` `optional` **filters?**: readonly [`AdminDataTableFilter`](/api/admin-react/src/type-aliases/admindatatablefilter/)\<`TData`\>[]

***

### generatedAt?

> `readonly` `optional` **generatedAt?**: `Date`

***

### grantedPermissions?

> `readonly` `optional` **grantedPermissions?**: readonly `string`[]

***

### loading?

> `readonly` `optional` **loading?**: `boolean`

***

### pagination?

> `readonly` `optional` **pagination?**: [`AdminDataTablePaginationSummary`](/api/admin-react/src/type-aliases/admindatatablepaginationsummary/)

***

### problem?

> `readonly` `optional` **problem?**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

***

### recoveryActions?

> `readonly` `optional` **recoveryActions?**: readonly [`AdminActionContract`](/api/admin-react/src/type-aliases/adminactioncontract/)[]

***

### requiredPermissions?

> `readonly` `optional` **requiredPermissions?**: readonly `string`[]

***

### resource

> `readonly` **resource**: [`AdminDataTableResource`](/api/admin-react/src/type-aliases/admindatatableresource/)\<`TData`\>

***

### result?

> `readonly` `optional` **result?**: [`AdminDataTableListResult`](/api/admin-react/src/type-aliases/admindatatablelistresult/)\<`TData`\>

***

### rows?

> `readonly` `optional` **rows?**: readonly `TData`[]

***

### selectedRowIds?

> `readonly` `optional` **selectedRowIds?**: readonly [`AdminDataTableRowId`](/api/admin-react/src/type-aliases/admindatatablerowid/)[]

***

### sorting?

> `readonly` `optional` **sorting?**: readonly [`AdminDataTableSort`](/api/admin-react/src/type-aliases/admindatatablesort/)\<`TData`\>[]
