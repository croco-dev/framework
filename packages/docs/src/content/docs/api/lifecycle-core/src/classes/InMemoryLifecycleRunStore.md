---
editUrl: false
next: false
prev: false
title: "InMemoryLifecycleRunStore"
---

## Implements

- [`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/)

## Constructors

### Constructor

> **new InMemoryLifecycleRunStore**(): `InMemoryLifecycleRunStore`

#### Returns

`InMemoryLifecycleRunStore`

## Methods

### findByIdempotencyKey()

> **findByIdempotencyKey**(`idempotencyKey`): `Promise`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/) \| `null`\>

#### Parameters

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/) \| `null`\>

#### Implementation of

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/).[`findByIdempotencyKey`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/#findbyidempotencykey)

***

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

#### Implementation of

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/).[`findLatestForRule`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/#findlatestforrule)

***

### list()

> **list**(`options?`): `Promise`\<readonly [`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)[]\>

#### Parameters

##### options?

[`LifecycleRunListOptions`](/api/lifecycle-core/src/type-aliases/lifecyclerunlistoptions/) = `{}`

#### Returns

`Promise`\<readonly [`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)[]\>

#### Implementation of

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/).[`list`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/#list)

***

### save()

> **save**(`run`): `Promise`\<`void`\>

#### Parameters

##### run

[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/).[`save`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/#save)
