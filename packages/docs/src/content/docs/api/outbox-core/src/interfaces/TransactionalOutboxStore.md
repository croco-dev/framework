---
editUrl: false
next: false
prev: false
title: "TransactionalOutboxStore"
---

Provider-neutral transactional outbox storage contract.

## Type Parameters

### TClient

`TClient` = `unknown`

## Methods

### claimBatch()

> **claimBatch**(`options`): `Promise`\<[`ClaimedOutboxRecord`](/api/outbox-core/src/type-aliases/claimedoutboxrecord/)[]\>

#### Parameters

##### options

[`ClaimBatchOptions`](/api/outbox-core/src/type-aliases/claimbatchoptions/)\<`TClient`\>

#### Returns

`Promise`\<[`ClaimedOutboxRecord`](/api/outbox-core/src/type-aliases/claimedoutboxrecord/)[]\>

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

---

### record()

> **record**(`intent`, `options`): `Promise`\<[`OutboxRecord`](/api/outbox-core/src/type-aliases/outboxrecord/)\>

#### Parameters

##### intent

[`OutboxIntent`](/api/outbox-core/src/type-aliases/outboxintent/)

##### options

[`OutboxRecordOptions`](/api/outbox-core/src/type-aliases/outboxrecordoptions/)\<`TClient`\>

#### Returns

`Promise`\<[`OutboxRecord`](/api/outbox-core/src/type-aliases/outboxrecord/)\>
