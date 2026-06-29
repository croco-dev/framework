---
editUrl: false
next: false
prev: false
title: "AdminFormField"
---

> **AdminFormField**\<`TValues`\>(`__namedParameters`): `ReactElement`

@croco/admin-react

Provider-neutral React primitives and contracts for SaaS billing, entitlement,
quota, usage, and provider status administration.

## Type Parameters

### TValues

`TValues` *extends* `object`

## Parameters

### \_\_namedParameters

#### errors

readonly [`AdminFormFieldError`](/api/admin-react/src/type-aliases/adminformfielderror/)[]

#### field

[`AdminFormFieldContract`](/api/admin-react/src/type-aliases/adminformfieldcontract/)\<`TValues`\>

#### fieldIdPrefix?

`string`

#### onFieldChange?

[`AdminFormFieldChangeHandler`](/api/admin-react/src/type-aliases/adminformfieldchangehandler/)\<`TValues`\>

#### value

`TValues`\[[`AdminFormFieldName`](/api/admin-react/src/type-aliases/adminformfieldname/)\<`TValues`\>\]

## Returns

`ReactElement`
