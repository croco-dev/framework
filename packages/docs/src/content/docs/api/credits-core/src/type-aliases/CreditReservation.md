---
editUrl: false
next: false
prev: false
title: "CreditReservation"
---

> **CreditReservation** = `object`

## Properties

### accountId

> `readonly` **accountId**: [`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)

***

### allocations

> `readonly` **allocations**: readonly [`CreditAllocation`](/api/credits-core/src/type-aliases/creditallocation/)[]

***

### amount

> `readonly` **amount**: [`CreditAmount`](/api/credits-core/src/type-aliases/creditamount/)

***

### createdAt

> `readonly` **createdAt**: `Date`

***

### id

> `readonly` **id**: [`CreditReservationId`](/api/credits-core/src/type-aliases/creditreservationid/)

***

### meterKey?

> `readonly` `optional` **meterKey?**: `string`

***

### settledAt?

> `readonly` `optional` **settledAt?**: `Date`

***

### status

> `readonly` **status**: `"active"` \| `"committed"` \| `"released"`
