---
editUrl: false
next: false
prev: false
title: "CreditOperationsTransaction"
---

> **CreditOperationsTransaction** = `object`

## Properties

### actorId?

> `readonly` `optional` **actorId?**: `string`

***

### adjustmentDirection?

> `readonly` `optional` **adjustmentDirection?**: `"credit"` \| `"debit"`

***

### allocations

> `readonly` **allocations**: readonly [`CreditOperationsAllocation`](/api/admin-core/src/type-aliases/creditoperationsallocation/)[]

***

### amount

> `readonly` **amount**: `string`

***

### correlationId?

> `readonly` `optional` **correlationId?**: `string`

***

### id

> `readonly` **id**: `string`

***

### kind

> `readonly` **kind**: [`CreditOperationsTransactionKind`](/api/admin-core/src/type-aliases/creditoperationstransactionkind/)

***

### meterKey?

> `readonly` `optional` **meterKey?**: `string`

***

### occurredAt

> `readonly` **occurredAt**: `Date`

***

### position

> `readonly` **position**: `number`

***

### reference

> `readonly` **reference**: [`CreditOperationsReference`](/api/admin-core/src/type-aliases/creditoperationsreference/)

***

### refundableAmount?

> `readonly` `optional` **refundableAmount?**: `string`

***

### relatedTransactionId?

> `readonly` `optional` **relatedTransactionId?**: `string`

***

### reservationId?

> `readonly` `optional` **reservationId?**: `string`
