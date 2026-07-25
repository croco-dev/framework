---
editUrl: false
next: false
prev: false
title: "AdjustCreditsCommand"
---

> **AdjustCreditsCommand** = [`CreditCommandBase`](/api/credits-core/src/type-aliases/creditcommandbase/) & `object`

## Type Declaration

### accountId

> `readonly` **accountId**: [`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)

### amount

> `readonly` **amount**: [`CreditAmount`](/api/credits-core/src/type-aliases/creditamount/)

### direction

> `readonly` **direction**: `"credit"` \| `"debit"`

### grant?

> `readonly` `optional` **grant?**: [`CreditGrantTerms`](/api/credits-core/src/type-aliases/creditgrantterms/)

### operation

> `readonly` **operation**: `"adjust"`

### transactionId

> `readonly` **transactionId**: [`CreditTransactionId`](/api/credits-core/src/type-aliases/credittransactionid/)
