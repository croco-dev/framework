---
editUrl: false
next: false
prev: false
title: "InMemoryOnboardingStore"
---

## Extends

- [`OnboardingStore`](/api/onboarding-core/src/classes/onboardingstore/)

## Constructors

### Constructor

> **new InMemoryOnboardingStore**(): `InMemoryOnboardingStore`

#### Returns

`InMemoryOnboardingStore`

#### Inherited from

[`OnboardingStore`](/api/onboarding-core/src/classes/onboardingstore/).[`constructor`](/api/onboarding-core/src/classes/onboardingstore/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`OnboardingStore`](/api/onboarding-core/src/classes/onboardingstore/)\>

#### Inherited from

[`OnboardingStore`](/api/onboarding-core/src/classes/onboardingstore/).[`token`](/api/onboarding-core/src/classes/onboardingstore/#token)

## Methods

### getState()

> **getState**(`tenantId`, `userId`, `onboardingId`): `Promise`\<[`OnboardingState`](/api/onboarding-core/src/interfaces/onboardingstate/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

##### onboardingId

`string`

#### Returns

`Promise`\<[`OnboardingState`](/api/onboarding-core/src/interfaces/onboardingstate/) \| `null`\>

#### Overrides

[`OnboardingStore`](/api/onboarding-core/src/classes/onboardingstore/).[`getState`](/api/onboarding-core/src/classes/onboardingstore/#getstate)

***

### saveState()

> **saveState**(`tenantId`, `userId`, `onboardingId`, `state`): `Promise`\<`void`\>

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

#### Overrides

[`OnboardingStore`](/api/onboarding-core/src/classes/onboardingstore/).[`saveState`](/api/onboarding-core/src/classes/onboardingstore/#savestate)
