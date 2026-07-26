---
editUrl: false
next: false
prev: false
title: "TenantHealthSummary"
---

> **TenantHealthSummary** = `object`

## Properties

### detailHref?

> `readonly` `optional` **detailHref?**: `string`

***

### kind

> `readonly` **kind**: `"health"`

***

### score

> `readonly` **score**: `number`

***

### signals

> `readonly` **signals**: readonly [`TenantHealthSignal`](/api/admin-core/src/type-aliases/tenanthealthsignal/)[]

***

### state

> `readonly` **state**: `"healthy"` \| `"at-risk"` \| `"critical"` \| `"unknown"`

***

### trend

> `readonly` **trend**: `"improving"` \| `"stable"` \| `"deteriorating"` \| `"unknown"`
