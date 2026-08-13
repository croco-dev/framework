---
editUrl: false
next: false
prev: false
title: "OnboardingStore"
---

## Extended by

- [`InMemoryOnboardingStore`](/api/onboarding-core/src/classes/inmemoryonboardingstore/)
- [`DrizzleOnboardingStore`](/api/onboarding-drizzle/src/classes/drizzleonboardingstore/)

## Constructors

### Constructor

> **new OnboardingStore**(): `OnboardingStore`

#### Returns

`OnboardingStore`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`OnboardingStore`\>

## Methods

### completeStep()

> `abstract` **completeStep**(`tenantId`, `userId`, `onboardingId`, `input`): `Promise`\<[`CompleteOnboardingStepResult`](/api/onboarding-core/src/type-aliases/completeonboardingstepresult/)\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

##### onboardingId

`string`

##### input

[`CompleteOnboardingStepInput`](/api/onboarding-core/src/interfaces/completeonboardingstepinput/)

#### Returns

`Promise`\<[`CompleteOnboardingStepResult`](/api/onboarding-core/src/type-aliases/completeonboardingstepresult/)\>

---

### getState()

> `abstract` **getState**(`tenantId`, `userId`, `onboardingId`): `Promise`\<[`OnboardingState`](/api/onboarding-core/src/interfaces/onboardingstate/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

##### onboardingId

`string`

#### Returns

`Promise`\<[`OnboardingState`](/api/onboarding-core/src/interfaces/onboardingstate/) \| `null`\>

---

### saveState()

> `abstract` **saveState**(`tenantId`, `userId`, `onboardingId`, `state`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

##### onboardingId

`string`

##### state

[`OnboardingState`](/api/onboarding-core/src/interfaces/onboardingstate/)

#### Returns

`Promise`\<`void`\>
