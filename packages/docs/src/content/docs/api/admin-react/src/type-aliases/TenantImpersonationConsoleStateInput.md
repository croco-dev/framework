---
editUrl: false
next: false
prev: false
title: "TenantImpersonationConsoleStateInput"
---

> **TenantImpersonationConsoleStateInput** = `object`

## Properties

### actions?

> `readonly` `optional` **actions?**: readonly [`AdminActionContract`](/api/admin-react/src/type-aliases/adminactioncontract/)[]

***

### generatedAt?

> `readonly` `optional` **generatedAt?**: `Date`

***

### grantedPermissions?

> `readonly` `optional` **grantedPermissions?**: readonly `string`[]

***

### impersonation?

> `readonly` `optional` **impersonation?**: [`AdminImpersonationStateInput`](/api/admin-react/src/type-aliases/adminimpersonationstateinput/)

***

### loading?

> `readonly` `optional` **loading?**: `boolean`

***

### permissionProblem?

> `readonly` `optional` **permissionProblem?**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

***

### permissions?

> `readonly` `optional` **permissions?**: readonly [`AdminPermissionInspectionInput`](/api/admin-react/src/type-aliases/adminpermissioninspectioninput/)[]

***

### providerFailure?

> `readonly` `optional` **providerFailure?**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

***

### requiredPermissions?

> `readonly` `optional` **requiredPermissions?**: readonly `string`[]

***

### selectedTenantId?

> `readonly` `optional` **selectedTenantId?**: `string`

***

### tenant?

> `readonly` `optional` **tenant?**: [`AdminTenantInput`](/api/admin-react/src/type-aliases/admintenantinput/) \| `null`

***

### tenantIsolationProblem?

> `readonly` `optional` **tenantIsolationProblem?**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

***

### tenants?

> `readonly` `optional` **tenants?**: readonly [`AdminTenantSwitchOptionInput`](/api/admin-react/src/type-aliases/admintenantswitchoptioninput/)[]
