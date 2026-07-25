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

***

### get()

> **get**(`ruleId`): [`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/) \| `undefined`\>

#### Parameters

##### ruleId

`string`

#### Returns

[`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/) \| `undefined`\>

***

### list()

> **list**(): [`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<readonly [`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)[]\>

#### Returns

[`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<readonly [`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)[]\>

***

### saveRegistration()

> **saveRegistration**(`record`): [`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)\>

#### Parameters

##### record

[`LifecycleRuleVersionRecord`](/api/lifecycle-core/src/type-aliases/lifecycleruleversionrecord/)

#### Returns

[`LifecycleRuleStateStoreResult`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatestoreresult/)\<[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/)\>
