---
editUrl: false
next: false
prev: false
title: "AdminFormContract"
---

> **AdminFormContract**\<`TValues`, `TResult`\> = `object`

## Type Parameters

### TValues

`TValues` _extends_ `object`

### TResult

`TResult` = `unknown`

## Properties

### audit

> `readonly` **audit**: [`AdminAuditMetadata`](/api/admin-react/src/type-aliases/adminauditmetadata/)

---

### fields

> `readonly` **fields**: [`NonEmptyArray`](/api/admin-react/src/type-aliases/nonemptyarray/)\<[`AdminFormFieldContract`](/api/admin-react/src/type-aliases/adminformfieldcontract/)\<`TValues`\>\>

---

### grantedPermissions?

> `readonly` `optional` **grantedPermissions?**: readonly `string`[]

---

### id

> `readonly` **id**: `string`

---

### initialValues

> `readonly` **initialValues**: `TValues`

---

### intent

> `readonly` **intent**: [`AdminFormIntent`](/api/admin-react/src/type-aliases/adminformintent/)

---

### recoveryActions?

> `readonly` `optional` **recoveryActions?**: readonly [`AdminFormRecoveryAction`](/api/admin-react/src/type-aliases/adminformrecoveryaction/)[]

---

### requiredPermissions?

> `readonly` `optional` **requiredPermissions?**: readonly `string`[]

---

### submit

> `readonly` **submit**: [`AdminFormSubmitHandler`](/api/admin-react/src/type-aliases/adminformsubmithandler/)\<`TValues`, `TResult`\>

---

### submitLabel?

> `readonly` `optional` **submitLabel?**: `string`

---

### successMessage?

> `readonly` `optional` **successMessage?**: `string`

---

### title

> `readonly` **title**: `string`
