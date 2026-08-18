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

### register()

> **register**(`definition`): `void`

#### Parameters

##### definition

[`OnboardingDefinition`](/api/onboarding-core/src/interfaces/onboardingdefinition/)

#### Returns

`void`
