---
editUrl: false
next: false
prev: false
title: "FrontendAuthGateDeniedState"
---

> **FrontendAuthGateDeniedState** = `object`

## Properties

### kind

> `readonly` **kind**: `"denied"`

---

### missingEntitlements

> `readonly` **missingEntitlements**: readonly `string`[]

---

### missingPermissions

> `readonly` **missingPermissions**: readonly `string`[]

---

### problem?

> `readonly` `optional` **problem?**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

---

### recoveryActions?

> `readonly` `optional` **recoveryActions?**: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]

---

### requiredEntitlements

> `readonly` **requiredEntitlements**: readonly `string`[]

---

### requiredPermissions

> `readonly` **requiredPermissions**: readonly `string`[]
