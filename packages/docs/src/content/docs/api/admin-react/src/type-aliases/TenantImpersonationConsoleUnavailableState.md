---
editUrl: false
next: false
prev: false
title: "TenantImpersonationConsoleUnavailableState"
---

> **TenantImpersonationConsoleUnavailableState** = `object`

## Properties

### actions

> `readonly` **actions**: readonly [`AdminActionContract`](/api/admin-react/src/type-aliases/adminactioncontract/)[]

---

### generatedAt

> `readonly` **generatedAt**: `Date`

---

### grantedPermissions

> `readonly` **grantedPermissions**: readonly `string`[]

---

### impersonation?

> `readonly` `optional` **impersonation?**: [`AdminImpersonationConsoleState`](/api/admin-react/src/type-aliases/adminimpersonationconsolestate/)

---

### kind

> `readonly` **kind**: `"unavailable"`

---

### permissions

> `readonly` **permissions**: readonly [`AdminPermissionInspectionRow`](/api/admin-react/src/type-aliases/adminpermissioninspectionrow/)[]

---

### problem

> `readonly` **problem**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

---

### tenant?

> `readonly` `optional` **tenant?**: [`AdminTenantSummary`](/api/admin-react/src/type-aliases/admintenantsummary/)
