---
editUrl: false
next: false
prev: false
title: "CancellationAction"
---

Durable cancellation choices, policy, source validation, and command receipts.

## Properties

### kind

> `readonly` **kind**: [`CancellationActionKind`](/api/billing-core/src/type-aliases/cancellationactionkind/)

## Methods

### available()

> **available**(`snapshot`): `boolean`

#### Parameters

##### snapshot

[`CancellationSnapshot`](/api/billing-core/src/type-aliases/cancellationsnapshot/)

#### Returns

`boolean`

---

### execute()

> **execute**(`input`): `Promise`\<[`CancellationCommandReceipt`](/api/billing-core/src/type-aliases/cancellationcommandreceipt/)\>

#### Parameters

##### input

###### choiceId?

`string`

###### commandId

`string`

###### session

[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)

#### Returns

`Promise`\<[`CancellationCommandReceipt`](/api/billing-core/src/type-aliases/cancellationcommandreceipt/)\>

---

### lookup()

> **lookup**(`input`): `Promise`\<[`CancellationCommandReceipt`](/api/billing-core/src/type-aliases/cancellationcommandreceipt/)\>

Reconcile the same logical command and idempotency key. Never allocate a new command identity.

#### Parameters

##### input

###### commandId

`string`

###### session

[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)

#### Returns

`Promise`\<[`CancellationCommandReceipt`](/api/billing-core/src/type-aliases/cancellationcommandreceipt/)\>
