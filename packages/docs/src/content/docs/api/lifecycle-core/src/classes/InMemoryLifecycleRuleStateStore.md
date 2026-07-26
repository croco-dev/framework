---
editUrl: false
next: false
prev: false
title: "InMemoryLifecycleRuleStateStore"
---

## Implements

- [`LifecycleRuleStateStore`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/)

## Constructors

### Constructor

> **new InMemoryLifecycleRuleStateStore**(`options?`): `InMemoryLifecycleRuleStateStore`

#### Parameters

##### options?

[`InMemoryLifecycleRuleStateStoreOptions`](/api/lifecycle-core/src/type-aliases/inmemorylifecyclerulestatestoreoptions/) = `{}`

#### Returns

`InMemoryLifecycleRuleStateStore`

## Methods

### applyCommand()

> **applyCommand**(`input`): [`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/) \| `Promise`\<[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)\>

#### Parameters

##### input

###### command

[`LifecycleRuleActivationCommandType`](/api/lifecycle-core/src/type-aliases/lifecycleruleactivationcommandtype/)

###### request

[`LifecycleRuleActivationCommand`](/api/lifecycle-core/src/type-aliases/lifecycleruleactivationcommand/)

#### Returns

[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/) \| `Promise`\<[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)\>

#### Implementation of

[`LifecycleRuleStateStore`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/).[`applyCommand`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/#applycommand)

---

### claimExecution()

> **claimExecution**(`claim`): [`LifecycleRuleExecutionClaimResult`](/api/lifecycle-core/src/type-aliases/lifecycleruleexecutionclaimresult/)

Atomically acquires an execution lease only while the requested version is active.
A command that deactivates the version must not complete until its leases are released
or expire, and must wake or retry when expiry arrives. Duplicate claim identifiers must
be rejected rather than shared.

#### Parameters

##### claim

[`LifecycleRuleExecutionClaim`](/api/lifecycle-core/src/type-aliases/lifecycleruleexecutionclaim/)

#### Returns

[`LifecycleRuleExecutionClaimResult`](/api/lifecycle-core/src/type-aliases/lifecycleruleexecutionclaimresult/)

#### Implementation of

[`LifecycleRuleStateStore`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/).[`claimExecution`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/#claimexecution)

---

### get()

> **get**(`ruleId`): [`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/) \| `undefined`

#### Parameters

##### ruleId

`string`

#### Returns

[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/) \| `undefined`

#### Implementation of

[`LifecycleRuleStateStore`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/).[`get`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/#get)

---

### list()

> **list**(): readonly [`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)[]

#### Returns

readonly [`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)[]

#### Implementation of

[`LifecycleRuleStateStore`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/).[`list`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/#list)

---

### releaseExecution()

> **releaseExecution**(`claimId`): `void`

#### Parameters

##### claimId

`string`

#### Returns

`void`

#### Implementation of

[`LifecycleRuleStateStore`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/).[`releaseExecution`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/#releaseexecution)

---

### saveRegistration()

> **saveRegistration**(`record`): [`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)

#### Parameters

##### record

[`LifecycleRuleVersionRecord`](/api/lifecycle-core/src/type-aliases/lifecycleruleversionrecord/)

#### Returns

[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)

#### Implementation of

[`LifecycleRuleStateStore`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/).[`saveRegistration`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/#saveregistration)
