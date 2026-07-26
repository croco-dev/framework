---
editUrl: false
next: false
prev: false
title: "ReserveCreditsCommand"
---

> **ReserveCreditsCommand** = [`CreditCommandBase`](/api/credits-core/src/type-aliases/creditcommandbase/) & `object`

## Type Declaration

### accountId

> `readonly` **accountId**: [`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)

### amount

> `readonly` **amount**: [`CreditAmount`](/api/credits-core/src/type-aliases/creditamount/)

### meterKey?

> `readonly` `optional` **meterKey?**: `string`

### operation

> `readonly` **operation**: `"reserve"`

### reservationId

> `readonly` **reservationId**: [`CreditReservationId`](/api/credits-core/src/type-aliases/creditreservationid/)

### transactionId

> `readonly` **transactionId**: [`CreditTransactionId`](/api/credits-core/src/type-aliases/credittransactionid/)
