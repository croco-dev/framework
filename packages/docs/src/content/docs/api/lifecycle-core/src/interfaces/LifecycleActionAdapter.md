---
editUrl: false
next: false
prev: false
title: "LifecycleActionAdapter"
---

## Methods

### execute()

> **execute**(`action`, `context`, `run`): `Promise`\<[`LifecycleActionResult`](/api/lifecycle-core/src/type-aliases/lifecycleactionresult/)\>

#### Parameters

##### action

[`LifecycleAction`](/api/lifecycle-core/src/type-aliases/lifecycleaction/)

##### context

[`LifecycleContext`](/api/lifecycle-core/src/type-aliases/lifecyclecontext/)

##### run

`Pick`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/), `"id"` \| `"idempotencyKey"` \| `"ruleId"` \| `"ruleVersion"` \| `"ruleFingerprint"` \| `"tenantId"`\>

#### Returns

`Promise`\<[`LifecycleActionResult`](/api/lifecycle-core/src/type-aliases/lifecycleactionresult/)\>
