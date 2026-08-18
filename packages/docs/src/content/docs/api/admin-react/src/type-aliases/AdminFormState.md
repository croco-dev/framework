---
editUrl: false
next: false
prev: false
title: "AdminFormState"
---

> **AdminFormState**\<`TValues`, `TResult`\> = `object`

## Type Parameters

### TValues

`TValues` *extends* `object`

### TResult

`TResult` = `unknown`

## Properties

### audit

> `readonly` **audit**: [`AdminAuditMetadata`](/api/admin-react/src/type-aliases/adminauditmetadata/)

***

### contractId

> `readonly` **contractId**: `string`

***

### dirtyFields

> `readonly` **dirtyFields**: readonly [`AdminFormFieldName`](/api/admin-react/src/type-aliases/adminformfieldname/)\<`TValues`\>[]

***

### fieldErrors

> `readonly` **fieldErrors**: [`AdminFormFieldErrors`](/api/admin-react/src/type-aliases/adminformfielderrors/)\<`TValues`\>

***

### fields

> `readonly` **fields**: [`NonEmptyArray`](/api/admin-react/src/type-aliases/nonemptyarray/)\<[`AdminFormFieldContract`](/api/admin-react/src/type-aliases/adminformfieldcontract/)\<`TValues`\>\>

***

### generatedAt

> `readonly` **generatedAt**: `Date`

***

### grantedPermissions

> `readonly` **grantedPermissions**: readonly `string`[]

***

### initialValues

> `readonly` **initialValues**: `TValues`

***

### intent

> `readonly` **intent**: [`AdminFormIntent`](/api/admin-react/src/type-aliases/adminformintent/)

***

### kind

> `readonly` **kind**: [`AdminFormLifecycleState`](/api/admin-react/src/type-aliases/adminformlifecyclestate/)

***

### lastSubmitAudit?

> `readonly` `optional` **lastSubmitAudit?**: [`AdminAuditMetadata`](/api/admin-react/src/type-aliases/adminauditmetadata/)

***

### problem?

> `readonly` `optional` **problem?**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

***

### problemKind?

> `readonly` `optional` **problemKind?**: [`AdminFormProblemKind`](/api/admin-react/src/type-aliases/adminformproblemkind/)

***

### recoveryActions

> `readonly` **recoveryActions**: readonly [`AdminFormRecoveryAction`](/api/admin-react/src/type-aliases/adminformrecoveryaction/)[]

***

### requiredPermissions

> `readonly` **requiredPermissions**: readonly `string`[]

***

### submitLabel

> `readonly` **submitLabel**: `string`

***

### submitResult?

> `readonly` `optional` **submitResult?**: `TResult`

***

### successMessage?

> `readonly` `optional` **successMessage?**: `string`

***

### title

> `readonly` **title**: `string`

***

### values

> `readonly` **values**: `TValues`
