---
editUrl: false
next: false
prev: false
title: "LifecycleRunStore"
---

## Methods

### findByIdempotencyKey()

> **findByIdempotencyKey**(`idempotencyKey`): `Promise`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/) \| `null`\>

#### Parameters

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/) \| `null`\>

***

### findLatestForRule()

> **findLatestForRule**(`tenantId`, `ruleId`, `since?`): `Promise`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### ruleId

`string`

##### since?

`Date`

#### Returns

`Promise`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/) \| `null`\>

***

### list()

> **list**(`options?`): `Promise`\<readonly [`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)[]\>

#### Parameters

##### options?

[`LifecycleRunListOptions`](/api/lifecycle-core/src/type-aliases/lifecyclerunlistoptions/)

#### Returns

`Promise`\<readonly [`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)[]\>

***

### save()

> **save**(`run`): `Promise`\<`void`\>

#### Parameters

##### run

[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)

#### Returns

`Promise`\<`void`\>
