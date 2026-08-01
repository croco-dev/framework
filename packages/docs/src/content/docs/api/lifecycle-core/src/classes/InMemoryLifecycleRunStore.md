---
editUrl: false
next: false
prev: false
title: "InMemoryLifecycleRunStore"
---

## Implements

- [`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/)

## Constructors

### Constructor

> **new InMemoryLifecycleRunStore**(): `InMemoryLifecycleRunStore`

#### Returns

`InMemoryLifecycleRunStore`

## Methods

### abortClaim()

> **abortClaim**(`runId`, `idempotencyKey`): `Promise`\<`void`\>

Releases an unfinished claim without removing a completed run.
Implementations must make this operation idempotent.

#### Parameters

##### runId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/).[`abortClaim`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/#abortclaim)

***

### claim()

> **claim**(`claim`): `Promise`\<[`LifecycleRunClaimResult`](/api/lifecycle-core/src/type-aliases/lifecyclerunclaimresult/)\>

Atomically reserves an idempotency key and optional cooldown window before dispatch.
Distributed adapters must enforce both constraints in one shared transaction.

#### Parameters

##### claim

[`LifecycleRunClaim`](/api/lifecycle-core/src/type-aliases/lifecyclerunclaim/)

#### Returns

`Promise`\<[`LifecycleRunClaimResult`](/api/lifecycle-core/src/type-aliases/lifecyclerunclaimresult/)\>

#### Implementation of

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/).[`claim`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/#claim)

***

### findByIdempotencyKey()

> **findByIdempotencyKey**(`idempotencyKey`): `Promise`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/) \| `null`\>

#### Parameters

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/) \| `null`\>

#### Implementation of

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/).[`findByIdempotencyKey`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/#findbyidempotencykey)

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

#### Implementation of

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/).[`findLatestForRule`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/#findlatestforrule)

***

### list()

> **list**(`options?`): `Promise`\<readonly [`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)[]\>

#### Parameters

##### options?

[`LifecycleRunListOptions`](/api/lifecycle-core/src/type-aliases/lifecyclerunlistoptions/) = `{}`

#### Returns

`Promise`\<readonly [`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)[]\>

#### Implementation of

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/).[`list`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/#list)

***

### save()

> **save**(`run`): `Promise`\<`void`\>

#### Parameters

##### run

[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/).[`save`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/#save)
