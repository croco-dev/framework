---
editUrl: false
next: false
prev: false
title: "PolarUsageDeliveryWorker"
---

Pulls a bounded number of durable usage claims and sends each one through the usage capability. Provider calls are
deliberately outside MeteringService.record(), preserving local request latency and journal replay semantics.

## Constructors

### Constructor

> **new PolarUsageDeliveryWorker**(`journal`, `usageGateway`, `options`): `PolarUsageDeliveryWorker`

#### Parameters

##### journal

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/)

##### usageGateway

[`UsageBillingGateway`](/api/billing-core/src/interfaces/usagebillinggateway/)

##### options

[`PolarUsageDeliveryWorkerOptions`](/api/billing-polar/src/type-aliases/polarusagedeliveryworkeroptions/)

#### Returns

`PolarUsageDeliveryWorker`

## Methods

### deliverNextBatch()

> **deliverNextBatch**(`now?`): `Promise`\<[`PolarUsageDeliveryRunResult`](/api/billing-polar/src/type-aliases/polarusagedeliveryrunresult/)\>

#### Parameters

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`PolarUsageDeliveryRunResult`](/api/billing-polar/src/type-aliases/polarusagedeliveryrunresult/)\>
