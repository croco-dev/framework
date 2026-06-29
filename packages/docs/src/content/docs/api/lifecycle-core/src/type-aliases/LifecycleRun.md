---
editUrl: false
next: false
prev: false
title: "LifecycleRun"
---

> **LifecycleRun** = `object`

## Properties

### actionResults

> `readonly` **actionResults**: readonly [`LifecycleActionResult`](/api/lifecycle-core/src/type-aliases/lifecycleactionresult/)[]

***

### completedAt

> `readonly` **completedAt**: `Date`

***

### error?

> `readonly` `optional` **error?**: `object`

#### code?

> `readonly` `optional` **code?**: `string`

#### message

> `readonly` **message**: `string`

***

### id

> `readonly` **id**: `string`

***

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

***

### ruleId

> `readonly` **ruleId**: `string`

***

### severity

> `readonly` **severity**: [`LifecycleSeverity`](/api/lifecycle-core/src/type-aliases/lifecycleseverity/)

***

### signalId?

> `readonly` `optional` **signalId?**: `string`

***

### signalType

> `readonly` **signalType**: [`LifecycleSignalType`](/api/lifecycle-core/src/type-aliases/lifecyclesignaltype/)

***

### skipReason?

> `readonly` `optional` **skipReason?**: [`LifecycleSkipReason`](/api/lifecycle-core/src/type-aliases/lifecycleskipreason/)

***

### startedAt

> `readonly` **startedAt**: `Date`

***

### status

> `readonly` **status**: [`LifecycleRunStatus`](/api/lifecycle-core/src/type-aliases/lifecyclerunstatus/)

***

### tenantId

> `readonly` **tenantId**: `string`
