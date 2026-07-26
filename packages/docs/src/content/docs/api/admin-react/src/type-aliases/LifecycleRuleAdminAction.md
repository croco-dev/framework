---
editUrl: false
next: false
prev: false
title: "LifecycleRuleAdminAction"
---

> **LifecycleRuleAdminAction** = [`AdminAction`](/api/admin-core/src/type-aliases/adminaction/) & `object`

## Type Declaration

### command

> `readonly` **command**: [`LifecycleRuleActivationCommandType`](/api/lifecycle-core/src/type-aliases/lifecycleruleactivationcommandtype/)

### descriptorFingerprint

> `readonly` **descriptorFingerprint**: `string`

### expectedRevision

> `readonly` **expectedRevision**: `number`

### id

> `readonly` **id**: `string`

### label

> `readonly` **label**: `string`

### permission

> `readonly` **permission**: `"lifecycle:write"`

### requiredInput

> `readonly` **requiredInput**: `object`

#### requiredInput.actor

> `readonly` **actor**: `true`

#### requiredInput.idempotencyKey

> `readonly` **idempotencyKey**: `true`

#### requiredInput.reason

> `readonly` **reason**: `true`

### ruleId

> `readonly` **ruleId**: `string`

### version

> `readonly` **version**: `string`

### warning?

> `readonly` `optional` **warning?**: `string`
