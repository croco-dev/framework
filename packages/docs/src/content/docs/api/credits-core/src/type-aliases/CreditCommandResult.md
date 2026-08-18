---
editUrl: false
next: false
prev: false
title: "CreditCommandResult"
---

> **CreditCommandResult** = `object`

## Properties

### account

> `readonly` **account**: [`CreditAccount`](/api/credits-core/src/type-aliases/creditaccount/)

***

### nextCursor?

> `readonly` `optional` **nextCursor?**: [`CreditExpiryCursor`](/api/credits-core/src/type-aliases/creditexpirycursor/)

***

### operation

> `readonly` **operation**: [`CreditLedgerCommand`](/api/credits-core/src/type-aliases/creditledgercommand/)\[`"operation"`\]

***

### replayed

> `readonly` **replayed**: `boolean`

***

### reservation?

> `readonly` `optional` **reservation?**: [`CreditReservation`](/api/credits-core/src/type-aliases/creditreservation/)

***

### transactions

> `readonly` **transactions**: readonly [`CreditTransaction`](/api/credits-core/src/type-aliases/credittransaction/)[]
