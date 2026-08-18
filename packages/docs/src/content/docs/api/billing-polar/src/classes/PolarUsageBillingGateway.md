---
editUrl: false
next: false
prev: false
title: "PolarUsageBillingGateway"
---

Polar implementation of the provider-neutral usage capability.

Polar returns aggregate insert/duplicate counts rather than event identities. Each event is therefore submitted
in its own provider request, retaining a deterministic Croco receipt for every journal claim.

## Implements

- [`UsageBillingGateway`](/api/billing-core/src/interfaces/usagebillinggateway/)

## Constructors

### Constructor

> **new PolarUsageBillingGateway**(`config`, `bindings`): `PolarUsageBillingGateway`

#### Parameters

##### config

[`PolarConfig`](/api/billing-polar/src/type-aliases/polarconfig/)

##### bindings

readonly [`PolarUsageMeterBinding`](/api/billing-polar/src/type-aliases/polarusagemeterbinding/)\<[`MeterRef`](/api/metering-core/src/type-aliases/meterref/)\>[]

#### Returns

`PolarUsageBillingGateway`

## Methods

### getCustomerMeterState()

> **getCustomerMeterState**(`query`): `Promise`\<[`CustomerMeterState`](/api/billing-core/src/type-aliases/customermeterstate/) \| `null`\>

#### Parameters

##### query

[`CustomerMeterStateQuery`](/api/billing-core/src/type-aliases/customermeterstatequery/)

#### Returns

`Promise`\<[`CustomerMeterState`](/api/billing-core/src/type-aliases/customermeterstate/) \| `null`\>

#### Implementation of

[`UsageBillingGateway`](/api/billing-core/src/interfaces/usagebillinggateway/).[`getCustomerMeterState`](/api/billing-core/src/interfaces/usagebillinggateway/#getcustomermeterstate)

---

### ingest()

> **ingest**(`events`): `Promise`\<[`UsageBillingBatchReceipt`](/api/billing-core/src/type-aliases/usagebillingbatchreceipt/)\>

#### Parameters

##### events

readonly [`UsageBillingEvent`](/api/billing-core/src/type-aliases/usagebillingevent/)[]

#### Returns

`Promise`\<[`UsageBillingBatchReceipt`](/api/billing-core/src/type-aliases/usagebillingbatchreceipt/)\>

#### Implementation of

[`UsageBillingGateway`](/api/billing-core/src/interfaces/usagebillinggateway/).[`ingest`](/api/billing-core/src/interfaces/usagebillinggateway/#ingest)
