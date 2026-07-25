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

> **applyCommand**(`input`): [`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)

#### Parameters

##### input

###### command

[`LifecycleRuleActivationCommandType`](/api/lifecycle-core/src/type-aliases/lifecycleruleactivationcommandtype/)

###### request

[`LifecycleRuleActivationCommand`](/api/lifecycle-core/src/type-aliases/lifecycleruleactivationcommand/)

#### Returns

[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)

#### Implementation of

[`LifecycleRuleStateStore`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/).[`applyCommand`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/#applycommand)

***

### get()

> **get**(`ruleId`): [`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/) \| `undefined`

#### Parameters

##### ruleId

`string`

#### Returns

[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/) \| `undefined`

#### Implementation of

[`LifecycleRuleStateStore`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/).[`get`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/#get)

***

### list()

> **list**(): readonly [`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)[]

#### Returns

readonly [`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)[]

#### Implementation of

[`LifecycleRuleStateStore`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/).[`list`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/#list)

***

### saveRegistration()

> **saveRegistration**(`record`): [`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)

#### Parameters

##### record

[`LifecycleRuleVersionRecord`](/api/lifecycle-core/src/type-aliases/lifecycleruleversionrecord/)

#### Returns

[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)

#### Implementation of

[`LifecycleRuleStateStore`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/).[`saveRegistration`](/api/lifecycle-core/src/interfaces/lifecyclerulestatestore/#saveregistration)
