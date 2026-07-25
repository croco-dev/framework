---
editUrl: false
next: false
prev: false
title: "LifecycleRuleRegistry"
---

## Constructors

### Constructor

> **new LifecycleRuleRegistry**(`options?`): `LifecycleRuleRegistry`

#### Parameters

##### options?

[`LifecycleRuleRegistryOptions`](/api/lifecycle-core/src/type-aliases/lifecycleruleregistryoptions/) = `{}`

#### Returns

`LifecycleRuleRegistry`

## Methods

### activate()

> **activate**(`request`): `Promise`\<[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)\>

#### Parameters

##### request

[`LifecycleRuleActivationCommand`](/api/lifecycle-core/src/type-aliases/lifecycleruleactivationcommand/)

#### Returns

`Promise`\<[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)\>

***

### get()

> **get**(`ruleId`): [`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/) \| `undefined`

Returns the synchronous local compatibility view.
Do not use this view as authoritative state for a shared durable store.

#### Parameters

##### ruleId

`string`

#### Returns

[`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/) \| `undefined`

***

### getAll()

> **getAll**(): readonly [`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/)[]

Returns the synchronous local compatibility view.
Await inspect(), getIdentityState(), or matchRegistrations() for versioned operations.

#### Returns

readonly [`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/)[]

***

### getIdentityState()

> **getIdentityState**(`ruleId`): `Promise`\<[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/) \| `undefined`\>

#### Parameters

##### ruleId

`string`

#### Returns

`Promise`\<[`LifecycleRuleIdentityState`](/api/lifecycle-core/src/type-aliases/lifecycleruleidentitystate/) \| `undefined`\>

***

### getRegistration()

> **getRegistration**(`ruleId`, `version`): [`LifecycleRuleRegistration`](/api/lifecycle-core/src/type-aliases/lifecycleruleregistration/) \| `undefined`

#### Parameters

##### ruleId

`string`

##### version

`string`

#### Returns

[`LifecycleRuleRegistration`](/api/lifecycle-core/src/type-aliases/lifecycleruleregistration/) \| `undefined`

***

### getRegistrationState()

> **getRegistrationState**(`ruleId`, `version`): `Promise`\<[`LifecycleRuleState`](/api/lifecycle-core/src/type-aliases/lifecyclerulestate/) \| `undefined`\>

#### Parameters

##### ruleId

`string`

##### version

`string`

#### Returns

`Promise`\<[`LifecycleRuleState`](/api/lifecycle-core/src/type-aliases/lifecyclerulestate/) \| `undefined`\>

***

### inspect()

> **inspect**(): `Promise`\<readonly [`LifecycleRuleInspection`](/api/lifecycle-core/src/type-aliases/lifecycleruleinspection/)[]\>

#### Returns

`Promise`\<readonly [`LifecycleRuleInspection`](/api/lifecycle-core/src/type-aliases/lifecycleruleinspection/)[]\>

***

### match()

> **match**(`signal`): readonly [`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/)[]

Matches the synchronous local compatibility view.
Production dispatch uses the authoritative asynchronous matchRegistrations() path.

#### Parameters

##### signal

[`LifecycleSignal`](/api/lifecycle-core/src/type-aliases/lifecyclesignal/)

#### Returns

readonly [`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/)[]

***

### matchRegistrations()

> **matchRegistrations**(`signal`): `Promise`\<readonly [`LifecycleRuleRegistration`](/api/lifecycle-core/src/type-aliases/lifecycleruleregistration/) & `object`[]\>

#### Parameters

##### signal

[`LifecycleSignal`](/api/lifecycle-core/src/type-aliases/lifecyclesignal/)

#### Returns

`Promise`\<readonly [`LifecycleRuleRegistration`](/api/lifecycle-core/src/type-aliases/lifecycleruleregistration/) & `object`[]\>

***

### pause()

> **pause**(`request`): `Promise`\<[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)\>

#### Parameters

##### request

[`LifecycleRuleActivationCommand`](/api/lifecycle-core/src/type-aliases/lifecycleruleactivationcommand/)

#### Returns

`Promise`\<[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)\>

***

### register()

> **register**(`rule`): `void`

#### Parameters

##### rule

[`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/)

#### Returns

`void`

***

### registerVersion()

> **registerVersion**(`input`): `Promise`\<[`LifecycleRuleRegistration`](/api/lifecycle-core/src/type-aliases/lifecycleruleregistration/)\>

#### Parameters

##### input

[`LifecycleRuleRegistrationInput`](/api/lifecycle-core/src/type-aliases/lifecycleruleregistrationinput/)

#### Returns

`Promise`\<[`LifecycleRuleRegistration`](/api/lifecycle-core/src/type-aliases/lifecycleruleregistration/)\>

***

### resume()

> **resume**(`request`): `Promise`\<[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)\>

#### Parameters

##### request

[`LifecycleRuleActivationCommand`](/api/lifecycle-core/src/type-aliases/lifecycleruleactivationcommand/)

#### Returns

`Promise`\<[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)\>

***

### supersede()

> **supersede**(`request`): `Promise`\<[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)\>

#### Parameters

##### request

[`LifecycleRuleActivationCommand`](/api/lifecycle-core/src/type-aliases/lifecycleruleactivationcommand/)

#### Returns

`Promise`\<[`LifecycleRuleStateMutation`](/api/lifecycle-core/src/type-aliases/lifecyclerulestatemutation/)\>
