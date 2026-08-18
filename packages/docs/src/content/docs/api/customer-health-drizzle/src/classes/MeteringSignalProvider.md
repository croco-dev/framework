---
editUrl: false
next: false
prev: false
title: "MeteringSignalProvider"
---

사용량 데이터를 usage 카테고리 신호로 변환하는 구현체입니다.

## Extends

- [`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/)

## Constructors

### Constructor

> **new MeteringSignalProvider**(`usageStorage`): `MeteringSignalProvider`

사용량 저장소를 받아 신호 제공자를 초기화합니다.

#### Parameters

##### usageStorage

[`UsageStorage`](/api/customer-health-drizzle/src/interfaces/usagestorage/)

#### Returns

`MeteringSignalProvider`

#### Overrides

[`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/).[`constructor`](/api/customer-health-core/src/classes/signalprovider/#constructor)

## Properties

### category

> `readonly` **category**: [`SignalCategory`](/api/customer-health-core/src/type-aliases/signalcategory/) = `"usage"`

#### Overrides

[`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/).[`category`](/api/customer-health-core/src/classes/signalprovider/#category)

---

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/)\>

#### Inherited from

[`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/).[`token`](/api/customer-health-core/src/classes/signalprovider/#token)

## Methods

### collect()

> **collect**(`tenantId`): `Promise`\<[`HealthSignal`](/api/customer-health-core/src/type-aliases/healthsignal/)[]\>

월간 사용량을 바탕으로 usage 신호를 수집합니다.

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`HealthSignal`](/api/customer-health-core/src/type-aliases/healthsignal/)[]\>

#### Overrides

[`SignalProvider`](/api/customer-health-core/src/classes/signalprovider/).[`collect`](/api/customer-health-core/src/classes/signalprovider/#collect)
