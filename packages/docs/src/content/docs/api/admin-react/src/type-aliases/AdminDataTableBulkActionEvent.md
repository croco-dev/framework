---
editUrl: false
next: false
prev: false
title: "AdminDataTableBulkActionEvent"
---

> **AdminDataTableBulkActionEvent**\<`TData`\> = `object`

## Type Parameters

### TData

`TData`

## Properties

### action

> `readonly` **action**: [`AdminActionContract`](/api/admin-react/src/type-aliases/adminactioncontract/)

---

### rows

> `readonly` **rows**: readonly [`AdminDataTableRow`](/api/admin-react/src/type-aliases/admindatatablerow/)\<`TData`\>[]

---

### selectedRowIds

> `readonly` **selectedRowIds**: readonly [`AdminDataTableRowId`](/api/admin-react/src/type-aliases/admindatatablerowid/)[]

---

### state

> `readonly` **state**: [`AdminDataTableReadyState`](/api/admin-react/src/type-aliases/admindatatablereadystate/)\<`TData`\> \| [`AdminDataTableEmptyState`](/api/admin-react/src/type-aliases/admindatatableemptystate/)\<`TData`\>
