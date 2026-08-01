---
editUrl: false
next: false
prev: false
title: "UsageBillingGateway"
---

Provider-neutral usage billing capability.

Duplicate events are successful acknowledgements and must be returned with a `duplicate` receipt.

## Methods

### getCustomerMeterState()

> **getCustomerMeterState**(`query`): `Promise`\<[`CustomerMeterState`](/api/billing-core/src/type-aliases/customermeterstate/) \| `null`\>

#### Parameters

##### query

[`CustomerMeterStateQuery`](/api/billing-core/src/type-aliases/customermeterstatequery/)

#### Returns

`Promise`\<[`CustomerMeterState`](/api/billing-core/src/type-aliases/customermeterstate/) \| `null`\>

***

### ingest()

> **ingest**(`events`): `Promise`\<[`UsageBillingBatchReceipt`](/api/billing-core/src/type-aliases/usagebillingbatchreceipt/)\>

#### Parameters

##### events

readonly [`UsageBillingEvent`](/api/billing-core/src/type-aliases/usagebillingevent/)[]

#### Returns

`Promise`\<[`UsageBillingBatchReceipt`](/api/billing-core/src/type-aliases/usagebillingbatchreceipt/)\>
