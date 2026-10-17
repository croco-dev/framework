---
editUrl: false
next: false
prev: false
title: "AdminFormFieldContract"
---

> **AdminFormFieldContract**\<`TValues`, `TName`\> = `object` & \{ `dateValueType?`: `never`; `inputType?`: `Exclude`\<[`AdminFormFieldType`](/api/admin-react/src/type-aliases/adminformfieldtype/), `"date"`\>; \} \| `{ [Name in TName]: [NonNullable<TValues[Name]>] extends [never] ? never : NonNullable<TValues[Name]> extends Date ? undefined extends TValues[Name] ? { dateValueType: "date"; inputType: "date"; name: Name } : never : NonNullable<TValues[Name]> extends string ? { dateValueType?: "string"; inputType: "date"; name: Name } : never }`\[`TName`\]

## Type Declaration

### description?

> `readonly` `optional` **description?**: `string`

### label

> `readonly` **label**: `string`

### name

> `readonly` **name**: `TName`

### options?

> `readonly` `optional` **options?**: readonly [`AdminFormFieldOption`](/api/admin-react/src/type-aliases/adminformfieldoption/)\<`TValues`\[`TName`\]\>[]

### required?

> `readonly` `optional` **required?**: `boolean`

### schemaPath?

> `readonly` `optional` **schemaPath?**: `string`

## Type Parameters

### TValues

`TValues` _extends_ `object`

### TName

`TName` _extends_ [`AdminFormFieldName`](/api/admin-react/src/type-aliases/adminformfieldname/)\<`TValues`\> = [`AdminFormFieldName`](/api/admin-react/src/type-aliases/adminformfieldname/)\<`TValues`\>
