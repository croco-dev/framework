---
editUrl: false
next: false
prev: false
title: "LifecycleRule"
---

> **LifecycleRule** = `object`

## Properties

### actions

> `readonly` **actions**: readonly [`LifecycleAction`](/api/lifecycle-core/src/type-aliases/lifecycleaction/)[] \| ((`context`) => readonly [`LifecycleAction`](/api/lifecycle-core/src/type-aliases/lifecycleaction/)[] \| `Promise`\<readonly [`LifecycleAction`](/api/lifecycle-core/src/type-aliases/lifecycleaction/)[]\>)

***

### conditionEvidence?

> `readonly` `optional` **conditionEvidence?**: (`context`) => [`LifecycleConditionEvidence`](/api/lifecycle-core/src/type-aliases/lifecycleconditionevidence/) \| `Promise`\<[`LifecycleConditionEvidence`](/api/lifecycle-core/src/type-aliases/lifecycleconditionevidence/)\>

#### Parameters

##### context

[`LifecycleContext`](/api/lifecycle-core/src/type-aliases/lifecyclecontext/)

#### Returns

[`LifecycleConditionEvidence`](/api/lifecycle-core/src/type-aliases/lifecycleconditionevidence/) \| `Promise`\<[`LifecycleConditionEvidence`](/api/lifecycle-core/src/type-aliases/lifecycleconditionevidence/)\>

***

### cooldown?

> `readonly` `optional` **cooldown?**: `object`

#### durationMs

> `readonly` **durationMs**: `number`

***

### description

> `readonly` **description**: `string`

***

### id

> `readonly` **id**: `string`

***

### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: [`LifecycleIdempotencyResolver`](/api/lifecycle-core/src/type-aliases/lifecycleidempotencyresolver/)

***

### severity

> `readonly` **severity**: [`LifecycleSeverity`](/api/lifecycle-core/src/type-aliases/lifecycleseverity/)

***

### triggers

> `readonly` **triggers**: readonly [`LifecycleTrigger`](/api/lifecycle-core/src/type-aliases/lifecycletrigger/)[]

***

### when?

> `readonly` `optional` **when?**: (`context`) => `boolean` \| `Promise`\<`boolean`\>

#### Parameters

##### context

[`LifecycleContext`](/api/lifecycle-core/src/type-aliases/lifecyclecontext/)

#### Returns

`boolean` \| `Promise`\<`boolean`\>
