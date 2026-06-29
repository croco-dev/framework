---
editUrl: false
next: false
prev: false
title: "BillingStoreSubscriptionProvider"
---

빌링 계정과 구독 정보를 이용해 현재 플랜 ID를 조회하는 구현체입니다.

## Extends

- [`SubscriptionProvider`](/api/entitlements-core/src/classes/subscriptionprovider/)

## Constructors

### Constructor

> **new BillingStoreSubscriptionProvider**(`billingStore`): `BillingStoreSubscriptionProvider`

빌링 스토어를 받아 구독 제공자를 초기화합니다.

#### Parameters

##### billingStore

[`BillingStore`](/api/billing-core/src/classes/billingstore/)

#### Returns

`BillingStoreSubscriptionProvider`

#### Overrides

[`SubscriptionProvider`](/api/entitlements-core/src/classes/subscriptionprovider/).[`constructor`](/api/entitlements-core/src/classes/subscriptionprovider/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`SubscriptionProvider`](/api/entitlements-core/src/classes/subscriptionprovider/)\>

#### Inherited from

[`SubscriptionProvider`](/api/entitlements-core/src/classes/subscriptionprovider/).[`token`](/api/entitlements-core/src/classes/subscriptionprovider/#token)

## Methods

### getCurrentPlanId()

> **getCurrentPlanId**(`tenantId`): `Promise`\<`string` \| `null`\>

테넌트의 현재 구독 플랜 ID를 반환합니다.

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`string` \| `null`\>

#### Overrides

[`SubscriptionProvider`](/api/entitlements-core/src/classes/subscriptionprovider/).[`getCurrentPlanId`](/api/entitlements-core/src/classes/subscriptionprovider/#getcurrentplanid)
