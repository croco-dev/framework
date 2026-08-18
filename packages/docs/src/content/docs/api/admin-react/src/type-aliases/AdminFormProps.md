---
editUrl: false
next: false
prev: false
title: "AdminFormProps"
---

> **AdminFormProps**\<`TValues`, `TResult`\> = `object`

## Type Parameters

### TValues

`TValues` *extends* `object`

### TResult

`TResult` = `unknown`

## Properties

### onFieldChange?

> `readonly` `optional` **onFieldChange?**: [`AdminFormFieldChangeHandler`](/api/admin-react/src/type-aliases/adminformfieldchangehandler/)\<`TValues`\>

***

### onRecoveryAction?

> `readonly` `optional` **onRecoveryAction?**: (`action`) => `void`

#### Parameters

##### action

[`AdminFormRecoveryAction`](/api/admin-react/src/type-aliases/adminformrecoveryaction/)

#### Returns

`void`

***

### onSubmit?

> `readonly` `optional` **onSubmit?**: () => `void`

#### Returns

`void`

***

### renderActions?

> `readonly` `optional` **renderActions?**: (`context`) => `ReactElement`

#### Parameters

##### context

[`AdminFormRenderActionsContext`](/api/admin-react/src/type-aliases/adminformrenderactionscontext/)\<`TValues`, `TResult`\>

#### Returns

`ReactElement`

***

### renderField?

> `readonly` `optional` **renderField?**: (`context`) => `ReactElement`

#### Parameters

##### context

[`AdminFormRenderFieldContext`](/api/admin-react/src/type-aliases/adminformrenderfieldcontext/)\<`TValues`, `TResult`\>

#### Returns

`ReactElement`

***

### state

> `readonly` **state**: [`AdminFormState`](/api/admin-react/src/type-aliases/adminformstate/)\<`TValues`, `TResult`\>
