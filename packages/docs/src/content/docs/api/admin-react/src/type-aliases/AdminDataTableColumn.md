---
editUrl: false
next: false
prev: false
title: "AdminDataTableColumn"
---

> **AdminDataTableColumn**\<`TData`, `TValue`\> = `object`

## Type Parameters

### TData

`TData`

### TValue

`TValue` = `unknown`

## Properties

### accessor?

> `readonly` `optional` **accessor?**: (`row`) => `TValue`

#### Parameters

##### row

`TData`

#### Returns

`TValue`

---

### field?

> `readonly` `optional` **field?**: [`AdminDataTableField`](/api/admin-react/src/type-aliases/admindatatablefield/)\<`TData`\>

---

### filterable?

> `readonly` `optional` **filterable?**: `boolean`

---

### header

> `readonly` **header**: `string`

---

### id

> `readonly` **id**: `string`

---

### render?

> `readonly` `optional` **render?**: (`context`) => `ReactNode`

#### Parameters

##### context

[`AdminDataTableCellContext`](/api/admin-react/src/type-aliases/admindatatablecellcontext/)\<`TData`, `TValue`\>

#### Returns

`ReactNode`

---

### sortable?

> `readonly` `optional` **sortable?**: `boolean`

---

### width?

> `readonly` `optional` **width?**: `string`
