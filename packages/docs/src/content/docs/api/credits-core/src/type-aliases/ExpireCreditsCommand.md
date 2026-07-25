---
editUrl: false
next: false
prev: false
title: "ExpireCreditsCommand"
---

> **ExpireCreditsCommand** = [`CreditCommandBase`](/api/credits-core/src/type-aliases/creditcommandbase/) & `object`

## Type Declaration

### accountId

> `readonly` **accountId**: [`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)

### asOf

> `readonly` **asOf**: `Date`

### cursor?

> `readonly` `optional` **cursor?**: [`CreditExpiryCursor`](/api/credits-core/src/type-aliases/creditexpirycursor/)

### limit

> `readonly` **limit**: `number`

### operation

> `readonly` **operation**: `"expire"`

### transactionIds

> `readonly` **transactionIds**: readonly [`CreditTransactionId`](/api/credits-core/src/type-aliases/credittransactionid/)[]
