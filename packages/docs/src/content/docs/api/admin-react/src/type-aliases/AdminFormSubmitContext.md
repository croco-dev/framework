---
editUrl: false
next: false
prev: false
title: "AdminFormSubmitContext"
---

> **AdminFormSubmitContext**\<`TValues`, `TResult`\> = `object`

## Type Parameters

### TValues

`TValues` *extends* `object`

### TResult

`TResult` = `unknown`

## Properties

### audit

> `readonly` **audit**: [`AdminAuditMetadata`](/api/admin-react/src/type-aliases/adminauditmetadata/)

***

### intent

> `readonly` **intent**: [`AdminFormIntent`](/api/admin-react/src/type-aliases/adminformintent/)

***

### previousState

> `readonly` **previousState**: [`AdminFormState`](/api/admin-react/src/type-aliases/adminformstate/)\<`TValues`, `TResult`\>

***

### signal?

> `readonly` `optional` **signal?**: `AbortSignal`

***

### values

> `readonly` **values**: `TValues`
