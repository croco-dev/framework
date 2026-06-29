---
editUrl: false
next: false
prev: false
title: "ServerActionFailureResult"
---

> **ServerActionFailureResult** = [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/) & `object`

## Type Declaration

### actionName?

> `readonly` `optional` **actionName?**: `string`

### fields?

> `readonly` `optional` **fields?**: [`ServerActionValidationFields`](/api/meta-vite/src/type-aliases/serveractionvalidationfields/)

### formErrors?

> `readonly` `optional` **formErrors?**: readonly `string`[]

### kind

> `readonly` **kind**: [`ServerActionProblemKind`](/api/meta-vite/src/type-aliases/serveractionproblemkind/)

### ok

> `readonly` **ok**: `false`

### path?

> `readonly` `optional` **path?**: `string`
