---
editUrl: false
next: false
prev: false
title: "LifecycleAutomationReadyState"
---

> **LifecycleAutomationReadyState** = `object`

## Properties

### dryRun?

> `readonly` `optional` **dryRun?**: [`LifecycleDryRunResponse`](/api/admin-react/src/type-aliases/lifecycledryrunresponse/)

---

### fixtures

> `readonly` **fixtures**: readonly [`LifecycleDryRunFixtureDescriptor`](/api/admin-react/src/type-aliases/lifecycledryrunfixturedescriptor/)[]

---

### generatedAt

> `readonly` **generatedAt**: `Date`

---

### grantedPermissions

> `readonly` **grantedPermissions**: readonly `string`[]

---

### kind

> `readonly` **kind**: `"ready"`

---

### problems

> `readonly` **problems**: readonly [`LifecycleOperationsProblem`](/api/admin-react/src/type-aliases/lifecycleoperationsproblem/)[]

---

### rules

> `readonly` **rules**: readonly [`LifecycleRuleOperation`](/api/admin-react/src/type-aliases/lifecycleruleoperation/)[]

---

### runs

> `readonly` **runs**: readonly [`LifecycleRunOperation`](/api/admin-react/src/type-aliases/lifecyclerunoperation/)[]
