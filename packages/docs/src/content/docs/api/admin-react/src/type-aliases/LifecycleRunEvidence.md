---
editUrl: false
next: false
prev: false
title: "LifecycleRunEvidence"
---

> **LifecycleRunEvidence** = `Omit`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/), `"actionResults"` \| `"error"` \| `"idempotencyKey"`\> & `object`

## Type Declaration

### actionResults

> `readonly` **actionResults**: readonly [`LifecycleRunActionEvidence`](/api/admin-react/src/type-aliases/lifecyclerunactionevidence/)[]

### error?

> `readonly` `optional` **error?**: `object`

#### error.code

> `readonly` **code**: `string`
