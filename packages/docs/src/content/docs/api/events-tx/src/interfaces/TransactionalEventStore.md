---
editUrl: false
next: false
prev: false
title: "TransactionalEventStore"
---

## Type Parameters

### TClient

`TClient` = `unknown`

## Methods

### appendOutbox()

> **appendOutbox**(`input`, `context?`): `Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)\>

#### Parameters

##### input

[`AppendOutboxMessageInput`](/api/events-tx/src/type-aliases/appendoutboxmessageinput/)

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)\>

***

### claimOutboxBatch()

> **claimOutboxBatch**(`options`, `context?`): `Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)[]\>

#### Parameters

##### options

[`OutboxClaimOptions`](/api/events-tx/src/type-aliases/outboxclaimoptions/)

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)[]\>

***

### findInboxRecord()

> **findInboxRecord**(`consumerId`, `inboxKey`, `context?`): `Promise`\<[`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/) \| `null`\>

#### Parameters

##### consumerId

`string`

##### inboxKey

`string`

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/) \| `null`\>

***

### findOutboxById()

> **findOutboxById**(`id`, `context?`): `Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/) \| `null`\>

#### Parameters

##### id

`string`

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/) \| `null`\>

***

### findOutboxByIdempotencyKey()

> **findOutboxByIdempotencyKey**(`idempotencyKey`, `context?`): `Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/) \| `null`\>

#### Parameters

##### idempotencyKey

`string`

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/) \| `null`\>

***

### listInboxRecords()

> **listInboxRecords**(`options?`, `context?`): `Promise`\<[`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/)[]\>

#### Parameters

##### options?

[`ListInboxRecordsOptions`](/api/events-tx/src/type-aliases/listinboxrecordsoptions/)

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/)[]\>

***

### listOutboxMessages()

> **listOutboxMessages**(`options?`, `context?`): `Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)[]\>

#### Parameters

##### options?

[`ListOutboxMessagesOptions`](/api/events-tx/src/type-aliases/listoutboxmessagesoptions/)

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)[]\>

***

### markInboxFailed()

> **markInboxFailed**(`input`, `context?`): `Promise`\<[`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/)\>

#### Parameters

##### input

[`InboxFailureInput`](/api/events-tx/src/type-aliases/inboxfailureinput/)

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/)\>

***

### markInboxProcessed()

> **markInboxProcessed**(`input`, `context?`): `Promise`\<[`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/)\>

#### Parameters

##### input

[`InboxCompletionInput`](/api/events-tx/src/type-aliases/inboxcompletioninput/)

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/)\>

***

### markOutboxDeadLettered()

> **markOutboxDeadLettered**(`input`, `context?`): `Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/) \| `null`\>

#### Parameters

##### input

[`OutboxDeadLetterInput`](/api/events-tx/src/type-aliases/outboxdeadletterinput/)

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/) \| `null`\>

***

### markOutboxFailed()

> **markOutboxFailed**(`input`, `context?`): `Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/) \| `null`\>

#### Parameters

##### input

[`OutboxFailureInput`](/api/events-tx/src/type-aliases/outboxfailureinput/)

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/) \| `null`\>

***

### markOutboxPublished()

> **markOutboxPublished**(`input`, `context?`): `Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/) \| `null`\>

#### Parameters

##### input

[`OutboxCompletionInput`](/api/events-tx/src/type-aliases/outboxcompletioninput/)

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/) \| `null`\>

***

### startInboxProcessing()

> **startInboxProcessing**(`input`, `context?`): `Promise`\<[`InboxStartResult`](/api/events-tx/src/type-aliases/inboxstartresult/)\>

#### Parameters

##### input

[`InboxStartInput`](/api/events-tx/src/type-aliases/inboxstartinput/)

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`InboxStartResult`](/api/events-tx/src/type-aliases/inboxstartresult/)\>
