---
editUrl: false
next: false
prev: false
title: "DrizzleOnboardingStore"
---

온보딩 상태를 Drizzle로 저장하고 조회하는 구현체입니다.

## Extends

- [`OnboardingStore`](/api/onboarding-core/src/classes/onboardingstore/)

## Constructors

### Constructor

> **new DrizzleOnboardingStore**(`db`, `txManager`): `DrizzleOnboardingStore`

Drizzle 클라이언트와 트랜잭션 매니저를 받아 저장소를 초기화합니다.

#### Parameters

##### db

[`DrizzleOnboardingClient`](/api/onboarding-drizzle/src/type-aliases/drizzleonboardingclient/)

##### txManager

[`TxManager`](/api/tx-core/src/classes/txmanager/)\<[`DrizzleOnboardingClient`](/api/onboarding-drizzle/src/type-aliases/drizzleonboardingclient/)\>

#### Returns

`DrizzleOnboardingStore`

#### Overrides

[`OnboardingStore`](/api/onboarding-core/src/classes/onboardingstore/).[`constructor`](/api/onboarding-core/src/classes/onboardingstore/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`OnboardingStore`](/api/onboarding-core/src/classes/onboardingstore/)\>

#### Inherited from

[`OnboardingStore`](/api/onboarding-core/src/classes/onboardingstore/).[`token`](/api/onboarding-core/src/classes/onboardingstore/#token)

## Methods

### getState()

> **getState**(`tenantId`, `userId`, `onboardingId`): `Promise`\<[`OnboardingState`](/api/onboarding-core/src/interfaces/onboardingstate/) \| `null`\>

테넌트, 사용자, 온보딩 ID 기준으로 상태를 조회합니다.

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

온보딩 상태를 upsert 방식으로 저장합니다.

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
