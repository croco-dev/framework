---
editUrl: false
next: false
prev: false
title: "AdminFormValidationFailure"
---

> **AdminFormValidationFailure**\<`TValues`\> = `object`

## Type Parameters

### TValues

`TValues` *extends* `object`

## Properties

### audit?

> `readonly` `optional` **audit?**: [`AdminAuditMetadata`](/api/admin-react/src/type-aliases/adminauditmetadata/)

***

### fieldErrors

> `readonly` **fieldErrors**: [`AdminFormFieldErrors`](/api/admin-react/src/type-aliases/adminformfielderrors/)\<`TValues`\>

***

### kind

> `readonly` **kind**: `"validation_failed"`

***

### problem?

> `readonly` `optional` **problem?**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

***

### recoveryActions?

> `readonly` `optional` **recoveryActions?**: readonly [`AdminFormRecoveryAction`](/api/admin-react/src/type-aliases/adminformrecoveryaction/)[]
