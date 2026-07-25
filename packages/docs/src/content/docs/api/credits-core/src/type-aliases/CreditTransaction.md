---
editUrl: false
next: false
prev: false
title: "CreditTransaction"
---

> **CreditTransaction** = `object`

## Properties

### accountId

> `readonly` **accountId**: [`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)

---

### adjustmentDirection?

> `readonly` `optional` **adjustmentDirection?**: `"credit"` \| `"debit"`

---

### allocations

> `readonly` **allocations**: readonly [`CreditAllocation`](/api/credits-core/src/type-aliases/creditallocation/)[]

---

### amount

> `readonly` **amount**: [`CreditAmount`](/api/credits-core/src/type-aliases/creditamount/)

---

### grant?

> `readonly` `optional` **grant?**: [`CreditGrantTerms`](/api/credits-core/src/type-aliases/creditgrantterms/)

---

### id

> `readonly` **id**: [`CreditTransactionId`](/api/credits-core/src/type-aliases/credittransactionid/)

---

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

---

### kind

> `readonly` **kind**: [`CreditTransactionKind`](/api/credits-core/src/type-aliases/credittransactionkind/)

---

### meterKey?

> `readonly` `optional` **meterKey?**: `string`

---

### occurredAt

> `readonly` **occurredAt**: `Date`

---

### position

> `readonly` **position**: `number`

---

### reference

> `readonly` **reference**: [`CreditSemanticReference`](/api/credits-core/src/type-aliases/creditsemanticreference/)

---

### relatedTransactionId?

> `readonly` `optional` **relatedTransactionId?**: [`CreditTransactionId`](/api/credits-core/src/type-aliases/credittransactionid/)

---

### reservationId?

> `readonly` `optional` **reservationId?**: [`CreditReservationId`](/api/credits-core/src/type-aliases/creditreservationid/)
