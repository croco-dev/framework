---
editUrl: false
next: false
prev: false
title: "AdminImpersonationExpiredInput"
---

> **AdminImpersonationExpiredInput** = `object`

## Properties

### exitAction

> `readonly` **exitAction**: [`AdminActionContract`](/api/admin-react/src/type-aliases/adminactioncontract/)

***

### impersonator?

> `readonly` `optional` **impersonator?**: [`AdminImpersonationPrincipal`](/api/admin-react/src/type-aliases/adminimpersonationprincipal/)

***

### kind

> `readonly` **kind**: `"expired"`

***

### problem?

> `readonly` `optional` **problem?**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

***

### session

> `readonly` **session**: [`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/)

***

### target?

> `readonly` `optional` **target?**: [`AdminImpersonationPrincipal`](/api/admin-react/src/type-aliases/adminimpersonationprincipal/)
