---
editUrl: false
next: false
prev: false
title: "SignalProvider"
---

## Extended by

- [`BillingSignalProvider`](/api/customer-health-drizzle/src/classes/billingsignalprovider/)
- [`MeteringSignalProvider`](/api/customer-health-drizzle/src/classes/meteringsignalprovider/)

## Constructors

### Constructor

> **new SignalProvider**(): `SignalProvider`

#### Returns

`SignalProvider`

## Properties

### category

> `abstract` `readonly` **category**: [`SignalCategory`](/api/customer-health-core/src/type-aliases/signalcategory/)

***

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`SignalProvider`\>

## Methods

### collect()

> `abstract` **collect**(`tenantId`): `Promise`\<[`HealthSignal`](/api/customer-health-core/src/type-aliases/healthsignal/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`HealthSignal`](/api/customer-health-core/src/type-aliases/healthsignal/)[]\>
