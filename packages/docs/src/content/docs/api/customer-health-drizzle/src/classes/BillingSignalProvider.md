---
editUrl: false
next: false
prev: false
title: "BillingSignalProvider"
---

구독 상태를 business 카테고리 신호로 변환하는 구현체입니다.

## Extends

- [`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/)

## Constructors

### Constructor

> **new BillingSignalProvider**(`subscriptionStorage`): `BillingSignalProvider`

구독 저장소를 받아 신호 제공자를 초기화합니다.

#### Parameters

##### subscriptionStorage

[`SubscriptionStorage`](/api/customer-health-drizzle/src/interfaces/subscriptionstorage/)

#### Returns

`BillingSignalProvider`

#### Overrides

[`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/).[`constructor`](/api/customer-health-core/src/classes/signalprovider/#constructor)

## Properties

### category

> `readonly` **category**: [`SignalCategory`](/api/customer-health-core/src/type-aliases/signalcategory/) = `"business"`

#### Overrides

[`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/).[`category`](/api/customer-health-core/src/classes/signalprovider/#category)

***

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/)\>

#### Inherited from

[`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/).[`token`](/api/customer-health-core/src/classes/signalprovider/#token)

## Methods

### collect()

> **collect**(`tenantId`): `Promise`\<[`HealthSignal`](/api/customer-health-core/src/type-aliases/healthsignal/)[]\>

테넌트의 구독 상태를 기반으로 비즈니스 신호를 수집합니다.

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`HealthSignal`](/api/customer-health-core/src/type-aliases/healthsignal/)[]\>

#### Overrides

[`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/).[`collect`](/api/customer-health-core/src/classes/signalprovider/#collect)
