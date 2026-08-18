---
editUrl: false
next: false
prev: false
title: "LifecycleRuleStateStore"
---

## Methods

### applyCommand()

> **applyCommand**(`input`): [`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)\>

#### Parameters

##### input

###### command

[`LifecycleRuleActivationCommandType`](/api/lifecycle-core/src/type-aliases/lifecycleruleactivationcommandtype/)

###### request

[`LifecycleRuleActivationCommand`](/api/lifecycle-core/src/type-aliases/lifecycleruleactivationcommand/)

#### Returns

[`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)\>

---

### claimExecution()

> **claimExecution**(`claim`): [`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<[`LifecycleRuleExecutionClaimResult`](/api/lifecycle-core/src/type-aliases/lifecycleruleexecutionclaimresult/)\>

Atomically acquires an execution lease only while the requested version is active.
A command that deactivates the version must not complete until its leases are released
or expire, and must wake or retry when expiry arrives. Duplicate claim identifiers must
be rejected rather than shared.

#### Parameters

##### claim

[`LifecycleRuleExecutionClaim`](/api/lifecycle-core/src/type-aliases/lifecycleruleexecutionclaim/)

#### Returns

[`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<[`LifecycleRuleExecutionClaimResult`](/api/lifecycle-core/src/type-aliases/lifecycleruleexecutionclaimresult/)\>

---

### get()

> **get**(`ruleId`): [`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/) \| `undefined`\>

#### Parameters

##### ruleId

`string`

#### Returns

[`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/) \| `undefined`\>

---

### list()

> **list**(): [`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<readonly [`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)[]\>

#### Returns

[`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<readonly [`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)[]\>

---

### releaseExecution()

> **releaseExecution**(`claimId`): [`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<`void`\>

#### Parameters

##### claimId

`string`

#### Returns

[`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<`void`\>

---

### saveRegistration()

> **saveRegistration**(`record`): [`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)\>

#### Parameters

##### record

[`LifecycleRuleVersionRecord`](/api/lifecycle-core/src/type-aliases/lifecycleruleversionrecord/)

#### Returns

[`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)\>
