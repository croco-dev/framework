---
editUrl: false
next: false
prev: false
title: "CreditOperationsMutationExecutor"
---

> **CreditOperationsMutationExecutor** = `object`

## Methods

### execute()

> **execute**(`input`): `Promise`\<[`CreditOperationsActionResult`](/api/admin-core/src/type-aliases/creditoperationsactionresult/)\>

Implementations must append the ledger transaction, idempotency claim, and audit evidence
atomically. They must never rewrite a prior transaction or set a mutable balance.

#### Parameters

##### input

###### action

[`CreditOperationsAction`](/api/admin-core/src/type-aliases/creditoperationsaction/)

###### request

[`CreditOperationsActionRequest`](/api/admin-core/src/type-aliases/creditoperationsactionrequest/)

#### Returns

`Promise`\<[`CreditOperationsActionResult`](/api/admin-core/src/type-aliases/creditoperationsactionresult/)\>
