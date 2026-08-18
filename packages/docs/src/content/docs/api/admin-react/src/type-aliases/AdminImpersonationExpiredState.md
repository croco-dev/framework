---
editUrl: false
next: false
prev: false
title: "AdminImpersonationExpiredState"
---

> **AdminImpersonationExpiredState** = `object`

## Properties

### exitAction

> `readonly` **exitAction**: [`AdminActionContract`](/api/admin-react/src/type-aliases/adminactioncontract/)

***

### impersonator

> `readonly` **impersonator**: [`AdminImpersonationPrincipal`](/api/admin-react/src/type-aliases/adminimpersonationprincipal/)

***

### kind

> `readonly` **kind**: `"expired"`

***

### mutability

> `readonly` **mutability**: `"editable"`

***

### problem

> `readonly` **problem**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

***

### session

> `readonly` **session**: [`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/)

***

### source

> `readonly` **source**: `"croco"`

***

### target

> `readonly` **target**: [`AdminImpersonationPrincipal`](/api/admin-react/src/type-aliases/adminimpersonationprincipal/)
