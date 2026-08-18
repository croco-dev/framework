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

Releases a claim and its indeterminate boundary only when dispatch is proven not to have
started. Never call this after an action adapter begins execution.
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

> **claim**(`claim`, `dispatchingRun`): `Promise`\<[`LifecycleRunClaimResult`](/api/lifecycle-core/src/type-aliases/lifecyclerunclaimresult/)\>

Atomically reserves an idempotency key and optional cooldown window before dispatch.
Distributed adapters must enforce both constraints in one shared transaction.

#### Parameters

##### claim

[`LifecycleRunClaim`](/api/lifecycle-core/src/type-aliases/lifecyclerunclaim/)

##### dispatchingRun

[`LifecycleIndeterminateRun`](/api/lifecycle-core/src/type-aliases/lifecycleindeterminaterun/)

#### Returns

`Promise`\<[`LifecycleRunClaimResult`](/api/lifecycle-core/src/type-aliases/lifecyclerunclaimresult/)\>

#### Implementation of

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/).[`claim`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/#claim)

***

### finalizeDispatch()

> **finalizeDispatch**(`run`): `Promise`\<\{ `finalized`: `false`; `reason`: `"dispatch_not_found"`; \} \| \{ `finalized`: `false`; `reason`: `"dispatch_fence_mismatch"`; \} \| \{ `finalized`: `true`; `reason?`: `undefined`; \}\>

Replaces an indeterminate run with reconciled action evidence using the run id as a fence.
A false result must retain the current claim and run evidence.

#### Parameters

##### run

[`LifecycleFinalizedRun`](/api/lifecycle-core/src/type-aliases/lifecyclefinalizedrun/)

#### Returns

`Promise`\<\{ `finalized`: `false`; `reason`: `"dispatch_not_found"`; \} \| \{ `finalized`: `false`; `reason`: `"dispatch_fence_mismatch"`; \} \| \{ `finalized`: `true`; `reason?`: `undefined`; \}\>

#### Implementation of

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/).[`finalizeDispatch`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/#finalizedispatch)

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

Persists a run that never crossed the action-dispatch boundary.

#### Parameters

##### run

[`LifecycleFinalizedRun`](/api/lifecycle-core/src/type-aliases/lifecyclefinalizedrun/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/).[`save`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/#save)
