---
editUrl: false
next: false
prev: false
title: "InMemoryTransactionalOutboxStore"
---

In-memory transactional outbox store implementation for conformance tests and local fixtures.

## Implements

- [`TransactionalOutboxStore`](/api/outbox-core/src/interfaces/transactionaloutboxstore/)\<[`InMemoryTransactionalOutboxStoreClient`](/api/outbox-core/src/type-aliases/inmemorytransactionaloutboxstoreclient/)\>

## Constructors

### Constructor

> **new InMemoryTransactionalOutboxStore**(): `InMemoryTransactionalOutboxStore`

#### Returns

`InMemoryTransactionalOutboxStore`

## Methods

### claimBatch()

> **claimBatch**(`options`): `Promise`\<[`ClaimedOutboxRecord`](/api/outbox-core/src/type-aliases/claimedoutboxrecord/)[]\>

#### Parameters

##### options

[`ClaimBatchOptions`](/api/outbox-core/src/type-aliases/claimbatchoptions/)\<[`InMemoryTransactionalOutboxStoreClient`](/api/outbox-core/src/type-aliases/inmemorytransactionaloutboxstoreclient/)\>

#### Returns

`Promise`\<[`ClaimedOutboxRecord`](/api/outbox-core/src/type-aliases/claimedoutboxrecord/)[]\>

#### Implementation of

[`TransactionalOutboxStore`](/api/outbox-core/src/interfaces/transactionaloutboxstore/).[`claimBatch`](/api/outbox-core/src/interfaces/transactionaloutboxstore/#claimbatch)

---

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

---

### findRecord()

> **findRecord**(`id`): `Promise`\<[`OutboxRecord`](/api/outbox-core/src/type-aliases/outboxrecord/) \| `null`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`OutboxRecord`](/api/outbox-core/src/type-aliases/outboxrecord/) \| `null`\>

---

### listRecords()

> **listRecords**(): `Promise`\<[`OutboxRecord`](/api/outbox-core/src/type-aliases/outboxrecord/)[]\>

#### Returns

`Promise`\<[`OutboxRecord`](/api/outbox-core/src/type-aliases/outboxrecord/)[]\>

---

### markDispatched()

> **markDispatched**(`id`, `result`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

##### result

[`DispatchResult`](/api/outbox-core/src/type-aliases/dispatchresult/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`TransactionalOutboxStore`](/api/outbox-core/src/interfaces/transactionaloutboxstore/).[`markDispatched`](/api/outbox-core/src/interfaces/transactionaloutboxstore/#markdispatched)

---

### markFailed()

> **markFailed**(`id`, `problem`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

##### problem

[`Problem`](/api/problems-core/src/classes/problem/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`TransactionalOutboxStore`](/api/outbox-core/src/interfaces/transactionaloutboxstore/).[`markFailed`](/api/outbox-core/src/interfaces/transactionaloutboxstore/#markfailed)

---

### record()

> **record**(`intent`, `options`): `Promise`\<[`OutboxRecord`](/api/outbox-core/src/type-aliases/outboxrecord/)\>

#### Parameters

##### intent

[`OutboxIntent`](/api/outbox-core/src/type-aliases/outboxintent/)

##### options

[`OutboxRecordOptions`](/api/outbox-core/src/type-aliases/outboxrecordoptions/)\<[`InMemoryTransactionalOutboxStoreClient`](/api/outbox-core/src/type-aliases/inmemorytransactionaloutboxstoreclient/)\>

#### Returns

`Promise`\<[`OutboxRecord`](/api/outbox-core/src/type-aliases/outboxrecord/)\>

#### Implementation of

[`TransactionalOutboxStore`](/api/outbox-core/src/interfaces/transactionaloutboxstore/).[`record`](/api/outbox-core/src/interfaces/transactionaloutboxstore/#record)

---

### runInUnitOfWork()

> **runInUnitOfWork**\<`T`\>(`fn`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

(`context`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>
