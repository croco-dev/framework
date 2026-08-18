---
editUrl: false
next: false
prev: false
title: "AdminDataTableResource"
---

> **AdminDataTableResource**\<`TData`\> = `object`

## Type Parameters

### TData

`TData`

## Properties

### bulkActions?

> `readonly` `optional` **bulkActions?**: readonly [`AdminActionContract`](/api/admin-react/src/type-aliases/adminactioncontract/)[]

---

### columns

> `readonly` **columns**: readonly [`AdminDataTableColumn`](/api/admin-react/src/type-aliases/admindatatablecolumn/)\<`TData`\>[]

---

### description?

> `readonly` `optional` **description?**: `string`

---

### filters?

> `readonly` `optional` **filters?**: readonly [`AdminDataTableFilterDefinition`](/api/admin-react/src/type-aliases/admindatatablefilterdefinition/)\<`TData`\>[]

---

### id

> `readonly` **id**: `string`

---

### label

> `readonly` **label**: `string`

---

### list?

> `readonly` `optional` **list?**: [`AdminDataTableListConfig`](/api/admin-react/src/type-aliases/admindatatablelistconfig/)\<`TData`\>

---

### requiredPermissions?

> `readonly` `optional` **requiredPermissions?**: readonly `string`[]

---

### rowActions?

> `readonly` `optional` **rowActions?**: readonly [`AdminActionContract`](/api/admin-react/src/type-aliases/adminactioncontract/)[]

---

### rowId

> `readonly` **rowId**: (`row`) => [`AdminDataTableRowId`](/api/admin-react/src/type-aliases/admindatatablerowid/)

#### Parameters

##### row

`TData`

#### Returns

[`AdminDataTableRowId`](/api/admin-react/src/type-aliases/admindatatablerowid/)
