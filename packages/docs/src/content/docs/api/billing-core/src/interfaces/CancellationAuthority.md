---
editUrl: false
next: false
prev: false
title: "CancellationAuthority"
---

Durable cancellation choices, policy, source validation, and command receipts.

## Methods

### admit()

> **admit**\<`T`\>(`identity`, `snapshot`, `operation`): `Promise`\<`T`\>

Serialize admission against application subscription/quote changes, revalidate pinned state, then execute the callback.

#### Type Parameters

##### T

`T`

#### Parameters

##### identity

[`CancellationIdentity`](/api/billing-core/src/type-aliases/cancellationidentity/)

##### snapshot

[`CancellationSnapshot`](/api/billing-core/src/type-aliases/cancellationsnapshot/)

##### operation

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

---

### authorize()

> **authorize**(`identity`): `Promise`\<`void`\>

Authenticate the subject and verify ownership using server credentials, never caller assertions.

#### Parameters

##### identity

[`CancellationIdentity`](/api/billing-core/src/type-aliases/cancellationidentity/)

#### Returns

`Promise`\<`void`\>

---

### authorizePolicy()

> **authorizePolicy**(`scope`, `actor`): `Promise`\<`void`\>

#### Parameters

##### scope

[`CancellationScope`](/api/billing-core/src/type-aliases/cancellationscope/)

##### actor

`string`

#### Returns

`Promise`\<`void`\>

---

### snapshot()

> **snapshot**(`identity`): `Promise`\<[`CancellationSnapshot`](/api/billing-core/src/type-aliases/cancellationsnapshot/)\>

#### Parameters

##### identity

[`CancellationIdentity`](/api/billing-core/src/type-aliases/cancellationidentity/)

#### Returns

`Promise`\<[`CancellationSnapshot`](/api/billing-core/src/type-aliases/cancellationsnapshot/)\>
