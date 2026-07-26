---
editUrl: false
next: false
prev: false
title: "LifecycleAutomationSourceOptions"
---

> **LifecycleAutomationSourceOptions** = `object`

## Properties

### evaluator

> `readonly` **evaluator**: [`LifecycleRuleEvaluator`](/api/lifecycle-core/src/classes/lifecycleruleevaluator/)

***

### fixtures?

> `readonly` `optional` **fixtures?**: readonly [`LifecycleDryRunFixture`](/api/admin-react/src/type-aliases/lifecycledryrunfixture/)[]

***

### listRecoveryItems?

> `readonly` `optional` **listRecoveryItems?**: () => `Promise`\<readonly [`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/)[]\>

#### Returns

`Promise`\<readonly [`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/)[]\>

***

### parsePastedContext?

> `readonly` `optional` **parsePastedContext?**: (`input`) => [`LifecycleContext`](/api/lifecycle-core/src/type-aliases/lifecyclecontext/) \| `Promise`\<[`LifecycleContext`](/api/lifecycle-core/src/type-aliases/lifecyclecontext/)\>

#### Parameters

##### input

`unknown`

#### Returns

[`LifecycleContext`](/api/lifecycle-core/src/type-aliases/lifecyclecontext/) \| `Promise`\<[`LifecycleContext`](/api/lifecycle-core/src/type-aliases/lifecyclecontext/)\>

***

### registry

> `readonly` **registry**: [`LifecycleRuleRegistry`](/api/lifecycle-core/src/classes/lifecycleruleregistry/)

***

### runLinks?

> `readonly` `optional` **runLinks?**: (`run`) => [`LifecycleRunOperation`](/api/admin-react/src/type-aliases/lifecyclerunoperation/)\[`"links"`\]

#### Parameters

##### run

[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)

#### Returns

[`LifecycleRunOperation`](/api/admin-react/src/type-aliases/lifecyclerunoperation/)\[`"links"`\]

***

### runStore

> `readonly` **runStore**: `Pick`\<[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/), `"list"`\>
