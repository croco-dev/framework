---
editUrl: false
next: false
prev: false
title: "LifecycleRuleActivationEvent"
---

> **LifecycleRuleActivationEvent** = `object`

## Properties

### actor?

> `readonly` `optional` **actor?**: `string`

***

### command

> `readonly` **command**: [`LifecycleRuleActivationCommandType`](/api/lifecycle-core/src/type-aliases/lifecycleruleactivationcommandtype/)

***

### commandId

> `readonly` **commandId**: `string`

***

### occurredAt

> `readonly` **occurredAt**: `Date`

***

### previousState

> `readonly` **previousState**: [`LifecycleRuleState`](/api/lifecycle-core/src/type-aliases/lifecyclerulestate/)

***

### reason?

> `readonly` `optional` **reason?**: `string`

***

### revision

> `readonly` **revision**: `number`

***

### ruleId

> `readonly` **ruleId**: `string`

***

### state

> `readonly` **state**: [`LifecycleRuleState`](/api/lifecycle-core/src/type-aliases/lifecyclerulestate/)

***

### version

> `readonly` **version**: `string`
