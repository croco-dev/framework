---
editUrl: false
next: false
prev: false
title: "DrizzleHealthSignalRegistry"
---

기본 건강 신호 제공자 조합을 반환하는 레지스트리입니다.

## Extends

- [`HealthSignalRegistry`](/api/customer-health-core/src/classes/healthsignalregistry/)

## Constructors

### Constructor

> **new DrizzleHealthSignalRegistry**(`meteringProvider`, `billingProvider`): `DrizzleHealthSignalRegistry`

사용량과 구독 신호 제공자를 받아 레지스트리를 초기화합니다.

#### Parameters

##### meteringProvider

[`MeteringSignalProvider`](/api/customer-health-drizzle/src/classes/meteringsignalprovider/)

##### billingProvider

[`BillingSignalProvider`](/api/customer-health-drizzle/src/classes/billingsignalprovider/)

#### Returns

`DrizzleHealthSignalRegistry`

#### Overrides

[`HealthSignalRegistry`](/api/customer-health-core/src/classes/healthsignalregistry/).[`constructor`](/api/customer-health-core/src/classes/healthsignalregistry/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`HealthSignalRegistry`](/api/customer-health-core/src/classes/healthsignalregistry/)\>

#### Inherited from

[`HealthSignalRegistry`](/api/customer-health-core/src/classes/healthsignalregistry/).[`token`](/api/customer-health-core/src/classes/healthsignalregistry/#token)

## Methods

### getProviders()

> **getProviders**(): [`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/)[]

건강 점수 계산에 사용할 신호 제공자 목록을 반환합니다.

#### Returns

[`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/)[]

#### Overrides

[`HealthSignalRegistry`](/api/customer-health-core/src/classes/healthsignalregistry/).[`getProviders`](/api/customer-health-core/src/classes/healthsignalregistry/#getproviders)
