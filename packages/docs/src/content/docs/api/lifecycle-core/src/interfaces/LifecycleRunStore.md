---
editUrl: false
next: false
prev: false
title: "LifecycleRunStore"
---

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

---

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

---

### finalizeDispatch()

> **finalizeDispatch**(`run`): `Promise`\<[`LifecycleRunFinalizationResult`](/api/lifecycle-core/src/type-aliases/lifecyclerunfinalizationresult/)\>

Replaces an indeterminate run with reconciled action evidence using the run id as a fence.
A false result must retain the current claim and run evidence.

#### Parameters

##### run

[`LifecycleFinalizedRun`](/api/lifecycle-core/src/type-aliases/lifecyclefinalizedrun/)

#### Returns

`Promise`\<[`LifecycleRunFinalizationResult`](/api/lifecycle-core/src/type-aliases/lifecyclerunfinalizationresult/)\>

---

### findByIdempotencyKey()

> **findByIdempotencyKey**(`idempotencyKey`): `Promise`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/) \| `null`\>

#### Parameters

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/) \| `null`\>

---

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

---

### list()

> **list**(`options?`): `Promise`\<readonly [`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)[]\>

#### Parameters

##### options?

[`LifecycleRunListOptions`](/api/lifecycle-core/src/type-aliases/lifecyclerunlistoptions/)

#### Returns

`Promise`\<readonly [`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)[]\>

---

### save()

> **save**(`run`): `Promise`\<`void`\>

Persists a run that never crossed the action-dispatch boundary.

#### Parameters

##### run

[`LifecycleFinalizedRun`](/api/lifecycle-core/src/type-aliases/lifecyclefinalizedrun/)

#### Returns

`Promise`\<`void`\>
