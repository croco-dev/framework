---
editUrl: false
next: false
prev: false
title: "InMemoryLifecycleDryRunStore"
---

## Implements

- [`LifecycleDryRunStore`](/api/lifecycle-core/src/interfaces/lifecycledryrunstore/)

## Constructors

### Constructor

> **new InMemoryLifecycleDryRunStore**(): `InMemoryLifecycleDryRunStore`

#### Returns

`InMemoryLifecycleDryRunStore`

## Methods

### list()

> **list**(`options?`): readonly [`LifecycleDryRunResult`](/api/lifecycle-core/src/type-aliases/lifecycledryrunresult/)[]

#### Parameters

##### options?

###### limit?

`number`

###### ruleId?

`string`

#### Returns

readonly [`LifecycleDryRunResult`](/api/lifecycle-core/src/type-aliases/lifecycledryrunresult/)[]

#### Implementation of

[`LifecycleDryRunStore`](/api/lifecycle-core/src/interfaces/lifecycledryrunstore/).[`list`](/api/lifecycle-core/src/interfaces/lifecycledryrunstore/#list)

***

### save()

> **save**(`result`): `void`

#### Parameters

##### result

[`LifecycleDryRunResult`](/api/lifecycle-core/src/type-aliases/lifecycledryrunresult/)

#### Returns

`void`

#### Implementation of

[`LifecycleDryRunStore`](/api/lifecycle-core/src/interfaces/lifecycledryrunstore/).[`save`](/api/lifecycle-core/src/interfaces/lifecycledryrunstore/#save)
