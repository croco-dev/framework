---
editUrl: false
next: false
prev: false
title: "InMemoryLifecycleActionSink"
---

## Implements

- [`LifecycleActionAdapter`](/api/lifecycle-core/src/interfaces/lifecycleactionadapter/)

## Constructors

### Constructor

> **new InMemoryLifecycleActionSink**(`options?`): `InMemoryLifecycleActionSink`

#### Parameters

##### options?

`InMemoryLifecycleActionSinkOptions` = `{}`

#### Returns

`InMemoryLifecycleActionSink`

## Methods

### execute()

> **execute**(`action`, `context`, `run`): `Promise`\<[`LifecycleActionResult`](/api/lifecycle-core/src/type-aliases/lifecycleactionresult/)\>

#### Parameters

##### action

[`LifecycleAction`](/api/lifecycle-core/src/type-aliases/lifecycleaction/)

##### context

[`LifecycleContext`](/api/lifecycle-core/src/type-aliases/lifecyclecontext/)

##### run

`Pick`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/), `"id"` \| `"ruleId"`\>

#### Returns

`Promise`\<[`LifecycleActionResult`](/api/lifecycle-core/src/type-aliases/lifecycleactionresult/)\>

#### Implementation of

[`LifecycleActionAdapter`](/api/lifecycle-core/src/interfaces/lifecycleactionadapter/).[`execute`](/api/lifecycle-core/src/interfaces/lifecycleactionadapter/#execute)

***

### getEmissions()

> **getEmissions**(): readonly `LifecycleActionEmission`[]

#### Returns

readonly `LifecycleActionEmission`[]
