---
editUrl: false
next: false
prev: false
title: "AdminFormRenderFieldContext"
---

> **AdminFormRenderFieldContext**\<`TValues`, `TResult`\> = `object`

## Type Parameters

### TValues

`TValues` *extends* `object`

### TResult

`TResult` = `unknown`

## Properties

### errors

> `readonly` **errors**: readonly [`AdminFormFieldError`](/api/admin-react/src/type-aliases/adminformfielderror/)[]

***

### field

> `readonly` **field**: [`AdminFormFieldContract`](/api/admin-react/src/type-aliases/adminformfieldcontract/)\<`TValues`\>

***

### state

> `readonly` **state**: [`AdminFormState`](/api/admin-react/src/type-aliases/adminformstate/)\<`TValues`, `TResult`\>

***

### value

> `readonly` **value**: `TValues`\[[`AdminFormFieldName`](/api/admin-react/src/type-aliases/adminformfieldname/)\<`TValues`\>\]
