---
editUrl: false
next: false
prev: false
title: "AdjustCreditsInput"
---

> **AdjustCreditsInput** = `CommandMetadata` & `object`

## Type Declaration

### accountId

> `readonly` **accountId**: [`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)

### amount

> `readonly` **amount**: [`CreditAmount`](/api/credits-core/src/type-aliases/creditamount/)

### direction

> `readonly` **direction**: `"credit"` \| `"debit"`

### expiresAt?

> `readonly` `optional` **expiresAt?**: `Date`

### meterKeys?

> `readonly` `optional` **meterKeys?**: readonly `string`[]

### source?

> `readonly` `optional` **source?**: `string`
