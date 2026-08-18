---
editUrl: false
next: false
prev: false
title: "AdminFormController"
---

> **AdminFormController**\<`TValues`, `TResult`\> = `object`

## Type Parameters

### TValues

`TValues` *extends* `object`

### TResult

`TResult` = `unknown`

## Properties

### contract

> `readonly` **contract**: [`AdminFormContract`](/api/admin-react/src/type-aliases/adminformcontract/)\<`TValues`, `TResult`\>

***

### reset

> `readonly` **reset**: () => `void`

#### Returns

`void`

***

### retry

> `readonly` **retry**: [`AdminFormSubmitAction`](/api/admin-react/src/type-aliases/adminformsubmitaction/)\<`TValues`, `TResult`\>

***

### setFieldValue

> `readonly` **setFieldValue**: [`AdminFormFieldChangeHandler`](/api/admin-react/src/type-aliases/adminformfieldchangehandler/)\<`TValues`\>

***

### state

> `readonly` **state**: [`AdminFormState`](/api/admin-react/src/type-aliases/adminformstate/)\<`TValues`, `TResult`\>

***

### submit

> `readonly` **submit**: [`AdminFormSubmitAction`](/api/admin-react/src/type-aliases/adminformsubmitaction/)\<`TValues`, `TResult`\>
