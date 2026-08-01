---
editUrl: false
next: false
prev: false
title: "MonetizationThresholdTracker"
---

## Constructors

### Constructor

> **new MonetizationThresholdTracker**(`store`): `MonetizationThresholdTracker`

#### Parameters

##### store

[`MonetizationThresholdStore`](/api/lifecycle-core/src/interfaces/monetizationthresholdstore/)

#### Returns

`MonetizationThresholdTracker`

## Methods

### acknowledge()

> **acknowledge**(`evaluation`): `Promise`\<`void`\>

#### Parameters

##### evaluation

[`MonetizationThresholdEvaluation`](/api/lifecycle-core/src/type-aliases/monetizationthresholdevaluation/)

#### Returns

`Promise`\<`void`\>

***

### evaluate()

> **evaluate**(`input`): `Promise`\<[`MonetizationThresholdEvaluation`](/api/lifecycle-core/src/type-aliases/monetizationthresholdevaluation/)\>

#### Parameters

##### input

`Omit`\<[`UsageThresholdCrossedSignalInput`](/api/lifecycle-core/src/type-aliases/usagethresholdcrossedsignalinput/), `"threshold"`\> & `object`

#### Returns

`Promise`\<[`MonetizationThresholdEvaluation`](/api/lifecycle-core/src/type-aliases/monetizationthresholdevaluation/)\>

***

### release()

> **release**(`evaluation`): `Promise`\<`void`\>

#### Parameters

##### evaluation

[`MonetizationThresholdEvaluation`](/api/lifecycle-core/src/type-aliases/monetizationthresholdevaluation/)

#### Returns

`Promise`\<`void`\>
