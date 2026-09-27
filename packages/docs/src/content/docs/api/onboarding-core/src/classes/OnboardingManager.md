---
editUrl: false
next: false
prev: false
title: "OnboardingManager"
---

## Constructors

### Constructor

> **new OnboardingManager**(`store`, `analytics`): `OnboardingManager`

#### Parameters

##### store

[`OnboardingStore`](/api/onboarding-core/src/classes/onboardingstore/)

##### analytics

[`AnalyticsManager`](/api/analytics-core/src/classes/analyticsmanager/)

#### Returns

`OnboardingManager`

## Methods

### completeStep()

> **completeStep**(`onboardingId`, `stepId`): `Promise`\<`void`\>

#### Parameters

##### onboardingId

`string`

##### stepId

`string`

#### Returns

`Promise`\<`void`\>

---

### getStatus()

> **getStatus**(`onboardingId`): `Promise`\<[`OnboardingState`](/api/onboarding-core/src/interfaces/onboardingstate/)\>

#### Parameters

##### onboardingId

`string`

#### Returns

`Promise`\<[`OnboardingState`](/api/onboarding-core/src/interfaces/onboardingstate/)\>

---

### handleGoalAchieved()

> **handleGoalAchieved**(`event`): `Promise`\<`boolean`\>

#### Parameters

##### event

[`GoalAchievedEventIntent`](/api/onboarding-core/src/type-aliases/goalachievedeventintent/)

#### Returns

`Promise`\<`boolean`\>

---

### register()

> **register**(`definition`): `void`

#### Parameters

##### definition

[`OnboardingDefinition`](/api/onboarding-core/src/interfaces/onboardingdefinition/)

#### Returns

`void`

---

### registerGoalStepBridge()

> **registerGoalStepBridge**(`input`): `void`

#### Parameters

##### input

###### goalDefinitionId

`string`

###### onboardingId

`string`

###### scope

[`GoalScope`](/api/onboarding-core/src/type-aliases/goalscope/)

###### stepId

`string`

#### Returns

`void`
