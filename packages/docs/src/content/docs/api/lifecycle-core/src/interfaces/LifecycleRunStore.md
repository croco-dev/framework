---
editUrl: false
next: false
prev: false
title: "LifecycleRunStore"
---

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

---

### claim()

> **claim**(`claim`): `Promise`\<[`LifecycleRunClaimResult`](/api/lifecycle-core/src/type-aliases/lifecyclerunclaimresult/)\>

Atomically reserves an idempotency key and optional cooldown window before dispatch.
Distributed adapters must enforce both constraints in one shared transaction.

#### Parameters

##### claim

[`LifecycleRunClaim`](/api/lifecycle-core/src/type-aliases/lifecyclerunclaim/)

#### Returns

`Promise`\<[`LifecycleRunClaimResult`](/api/lifecycle-core/src/type-aliases/lifecyclerunclaimresult/)\>

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

#### Parameters

##### run

[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)

#### Returns

`Promise`\<`void`\>
