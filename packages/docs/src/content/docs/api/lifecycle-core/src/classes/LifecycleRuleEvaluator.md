---
editUrl: false
next: false
prev: false
title: "LifecycleRuleEvaluator"
---

## Constructors

### Constructor

> **new LifecycleRuleEvaluator**(`options`): `LifecycleRuleEvaluator`

#### Parameters

##### options

[`LifecycleRuleEvaluatorOptions`](/api/lifecycle-core/src/type-aliases/lifecycleruleevaluatoroptions/)

#### Returns

`LifecycleRuleEvaluator`

## Methods

### dryRun()

> **dryRun**(`input`): `Promise`\<[`LifecycleDryRunResult`](/api/lifecycle-core/src/type-aliases/lifecycledryrunresult/)\>

#### Parameters

##### input

[`LifecycleDryRunInput`](/api/lifecycle-core/src/type-aliases/lifecycledryruninput/)

#### Returns

`Promise`\<[`LifecycleDryRunResult`](/api/lifecycle-core/src/type-aliases/lifecycledryrunresult/)\>

***

### evaluate()

> **evaluate**(`context`): `Promise`\<[`LifecycleEvaluationResult`](/api/lifecycle-core/src/type-aliases/lifecycleevaluationresult/)\>

#### Parameters

##### context

[`LifecycleContext`](/api/lifecycle-core/src/type-aliases/lifecyclecontext/)

#### Returns

`Promise`\<[`LifecycleEvaluationResult`](/api/lifecycle-core/src/type-aliases/lifecycleevaluationresult/)\>
