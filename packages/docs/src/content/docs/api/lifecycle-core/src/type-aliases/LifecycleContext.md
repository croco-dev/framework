---
editUrl: false
next: false
prev: false
title: "LifecycleContext"
---

> **LifecycleContext** = `object`

## Properties

### billing?

> `readonly` `optional` **billing?**: [`LifecycleBillingSummary`](/api/lifecycle-core/src/type-aliases/lifecyclebillingsummary/)

***

### health?

> `readonly` `optional` **health?**: [`LifecycleHealthSummary`](/api/lifecycle-core/src/type-aliases/lifecyclehealthsummary/)

***

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### now

> `readonly` **now**: `Date`

***

### onboarding?

> `readonly` `optional` **onboarding?**: [`LifecycleOnboardingSummary`](/api/lifecycle-core/src/type-aliases/lifecycleonboardingsummary/)

***

### signal

> `readonly` **signal**: [`LifecycleSignal`](/api/lifecycle-core/src/type-aliases/lifecyclesignal/)

***

### tenantId

> `readonly` **tenantId**: `string`

***

### usage?

> `readonly` `optional` **usage?**: readonly [`LifecycleUsageSummary`](/api/lifecycle-core/src/type-aliases/lifecycleusagesummary/)[]
