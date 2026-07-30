---
editUrl: false
next: false
prev: false
title: "StaticSubscriptionProvider"
---

단일 플랜을 고정으로 반환하는 구독 제공자 구현체입니다.

## Extends

- [`SubscriptionProvider`](/api/entitlements-core/src/classes/subscriptionprovider/)

## Constructors

### Constructor

> **new StaticSubscriptionProvider**(`defaultPlan`): `StaticSubscriptionProvider`

#### Parameters

##### defaultPlan

`string` \| [`SubscriptionPlanReference`](/api/entitlements-core/src/type-aliases/subscriptionplanreference/)

#### Returns

`StaticSubscriptionProvider`

#### Overrides

[`SubscriptionProvider`](/api/entitlements-core/src/classes/subscriptionprovider/).[`constructor`](/api/entitlements-core/src/classes/subscriptionprovider/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`SubscriptionProvider`](/api/entitlements-core/src/classes/subscriptionprovider/)\>

#### Inherited from

[`SubscriptionProvider`](/api/entitlements-core/src/classes/subscriptionprovider/).[`token`](/api/entitlements-core/src/classes/subscriptionprovider/#token)

## Methods

### getCurrentPlanId()

> **getCurrentPlanId**(`_tenantId`): `Promise`\<`string` \| `null`\>

#### Parameters

##### \_tenantId

`string`

#### Returns

`Promise`\<`string` \| `null`\>

#### Overrides

[`SubscriptionProvider`](/api/entitlements-core/src/classes/subscriptionprovider/).[`getCurrentPlanId`](/api/entitlements-core/src/classes/subscriptionprovider/#getcurrentplanid)

***

### getCurrentPlanVersion()

> `readonly` **getCurrentPlanVersion**(`_tenantId`): `Promise`\<[`SubscriptionPlanReference`](/api/entitlements-core/src/type-aliases/subscriptionplanreference/) \| `null`\>

#### Parameters

##### \_tenantId

`string`

#### Returns

`Promise`\<[`SubscriptionPlanReference`](/api/entitlements-core/src/type-aliases/subscriptionplanreference/) \| `null`\>

#### Overrides

`SubscriptionProvider.getCurrentPlanVersion`
