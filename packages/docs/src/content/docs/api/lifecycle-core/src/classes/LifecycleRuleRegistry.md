---
editUrl: false
next: false
prev: false
title: "LifecycleRuleRegistry"
---

## Constructors

### Constructor

> **new LifecycleRuleRegistry**(): `LifecycleRuleRegistry`

#### Returns

`LifecycleRuleRegistry`

## Methods

### get()

> **get**(`ruleId`): [`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/) \| `undefined`

#### Parameters

##### ruleId

`string`

#### Returns

[`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/) \| `undefined`

***

### getAll()

> **getAll**(): readonly [`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/)[]

#### Returns

readonly [`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/)[]

***

### match()

> **match**(`signal`): readonly [`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/)[]

#### Parameters

##### signal

[`LifecycleSignal`](/api/lifecycle-core/src/type-aliases/lifecyclesignal/)

#### Returns

readonly [`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/)[]

***

### register()

> **register**(`rule`): `void`

#### Parameters

##### rule

[`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/)

#### Returns

`void`
