---
editUrl: false
next: false
prev: false
title: "BillingCancellationAction"
---

Binds existing billing lifecycle commands to an application's isolated billing store. Refund execution is never inferred.

## Implements

- [`CancellationAction`](/api/billing-core/src/interfaces/cancellationaction/)

## Constructors

### Constructor

> **new BillingCancellationAction**(`kind`, `scope`, `billing`, `store`, `authority`): `BillingCancellationAction`

#### Parameters

##### kind

`"resume"` \| `"cancel"`

##### scope

[`CancellationScope`](/api/billing-core/src/type-aliases/cancellationscope/)

##### billing

[`BillingService`](/api/billing-core/src/classes/billingservice/)

##### store

[`BillingStore`](/api/billing-core/src/classes/billingstore/)

##### authority

[`CancellationAuthority`](/api/billing-core/src/interfaces/cancellationauthority/)

#### Returns

`BillingCancellationAction`

## Properties

### kind

> `readonly` **kind**: `"resume"` \| `"cancel"`

#### Implementation of

[`CancellationAction`](/api/billing-core/src/interfaces/cancellationaction/).[`kind`](/api/billing-core/src/interfaces/cancellationaction/#kind)

## Methods

### available()

> **available**(`snapshot`): `boolean`

#### Parameters

##### snapshot

[`CancellationSnapshot`](/api/billing-core/src/type-aliases/cancellationsnapshot/)

#### Returns

`boolean`

#### Implementation of

[`CancellationAction`](/api/billing-core/src/interfaces/cancellationaction/).[`available`](/api/billing-core/src/interfaces/cancellationaction/#available)

---

### execute()

> **execute**(`input`): `Promise`\<[`CancellationCommandReceipt`](/api/billing-core/src/type-aliases/cancellationcommandreceipt/)\>

#### Parameters

##### input

###### commandId

`string`

###### session

[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)

#### Returns

`Promise`\<[`CancellationCommandReceipt`](/api/billing-core/src/type-aliases/cancellationcommandreceipt/)\>

#### Implementation of

[`CancellationAction`](/api/billing-core/src/interfaces/cancellationaction/).[`execute`](/api/billing-core/src/interfaces/cancellationaction/#execute)

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

#### Implementation of

[`CancellationAction`](/api/billing-core/src/interfaces/cancellationaction/).[`lookup`](/api/billing-core/src/interfaces/cancellationaction/#lookup)
