---
editUrl: false
next: false
prev: false
title: "UsageBillingConformanceFixtures"
---

> **UsageBillingConformanceFixtures** = `object`

## Properties

### customerMeterState

> `readonly` **customerMeterState**: `Omit`\<[`CustomerMeterState`](/api/billing-core/src/type-aliases/customermeterstate/), `"updatedAt"`\>

***

### emptyCustomerMeterStateQuery

> `readonly` **emptyCustomerMeterStateQuery**: [`CustomerMeterStateQuery`](/api/billing-core/src/type-aliases/customermeterstatequery/)

***

### events

> `readonly` **events**: readonly [`UsageBillingEvent`](/api/billing-core/src/type-aliases/usagebillingevent/)[]

***

### partialBatch

> `readonly` **partialBatch**: `object`

#### events

> `readonly` **events**: readonly [`UsageBillingEvent`](/api/billing-core/src/type-aliases/usagebillingevent/)[]

#### expectedReceipts

> `readonly` **expectedReceipts**: `Readonly`\<`Record`\<`string`, [`UsageBillingEventReceipt`](/api/billing-core/src/type-aliases/usagebillingeventreceipt/)\[`"status"`\]\>\>

#### maxEvents

> `readonly` **maxEvents**: `number`
