---
editUrl: false
next: false
prev: false
title: "MonetizationSubscriptionConditionTracker"
---

## Constructors

### Constructor

> **new MonetizationSubscriptionConditionTracker**(`store`): `MonetizationSubscriptionConditionTracker`

#### Parameters

##### store

[`MonetizationConditionStore`](/api/lifecycle-core/src/interfaces/monetizationconditionstore/)

#### Returns

`MonetizationSubscriptionConditionTracker`

## Methods

### observePastDue()

> **observePastDue**(`input`): `Promise`\<[`MonetizationConditionEvaluation`](/api/lifecycle-core/src/type-aliases/monetizationconditionevaluation/)\<[`LifecycleSignal`](/api/lifecycle-core/src/type-aliases/lifecyclesignal/) & `object`\>\>

#### Parameters

##### input

[`SubscriptionPastDueSignalInput`](/api/lifecycle-core/src/type-aliases/subscriptionpastduesignalinput/)

#### Returns

`Promise`\<[`MonetizationConditionEvaluation`](/api/lifecycle-core/src/type-aliases/monetizationconditionevaluation/)\<[`LifecycleSignal`](/api/lifecycle-core/src/type-aliases/lifecyclesignal/) & `object`\>\>

---

### observeRecovered()

> **observeRecovered**(`input`): `Promise`\<[`MonetizationConditionEvaluation`](/api/lifecycle-core/src/type-aliases/monetizationconditionevaluation/)\<[`LifecycleSignal`](/api/lifecycle-core/src/type-aliases/lifecyclesignal/) & `object`\>\>

#### Parameters

##### input

[`SubscriptionRecoveredSignalInput`](/api/lifecycle-core/src/type-aliases/subscriptionrecoveredsignalinput/)

#### Returns

`Promise`\<[`MonetizationConditionEvaluation`](/api/lifecycle-core/src/type-aliases/monetizationconditionevaluation/)\<[`LifecycleSignal`](/api/lifecycle-core/src/type-aliases/lifecyclesignal/) & `object`\>\>
