---
editUrl: false
next: false
prev: false
title: "UsageBillingEvent"
---

> **UsageBillingEvent** = `object`

Provider-neutral usage event ingestion and customer meter state contracts.

## Properties

### billingAccountId

> `readonly` **billingAccountId**: `string`

***

### dimensions?

> `readonly` `optional` **dimensions?**: `Readonly`\<`Record`\<`string`, [`UsageBillingDimensionValue`](/api/billing-core/src/type-aliases/usagebillingdimensionvalue/)\>\>

***

### eventId

> `readonly` **eventId**: `string`

***

### meterId

> `readonly` **meterId**: `string`

***

### occurredAt

> `readonly` **occurredAt**: `Date`

***

### value

> `readonly` **value**: `number`
