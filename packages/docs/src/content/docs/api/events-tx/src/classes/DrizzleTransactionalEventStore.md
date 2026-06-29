---
editUrl: false
next: false
prev: false
title: "DrizzleTransactionalEventStore"
---

Drizzle query-client implementation for the transactional outbox/inbox store.

## Type Parameters

### TDb

`TDb` *extends* [`DrizzleTransactionalEventStoreDb`](/api/events-tx/src/type-aliases/drizzletransactionaleventstoredb/)

### TClient

`TClient` *extends* [`DrizzleTransactionalEventStoreDb`](/api/events-tx/src/type-aliases/drizzletransactionaleventstoredb/) = `TDb`

## Implements

- [`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/)\<`TClient`\>

## Constructors

### Constructor

> **new DrizzleTransactionalEventStore**\<`TDb`, `TClient`\>(`config`): `DrizzleTransactionalEventStore`\<`TDb`, `TClient`\>

#### Parameters

##### config

[`DrizzleTransactionalEventStoreConfig`](/api/events-tx/src/type-aliases/drizzletransactionaleventstoreconfig/)\<`TDb`, `TClient`\>

#### Returns

`DrizzleTransactionalEventStore`\<`TDb`, `TClient`\>

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

#### Implementation of

[`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/).[`appendOutbox`](/api/events-tx/src/interfaces/transactionaleventstore/#appendoutbox)

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

#### Implementation of

[`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/).[`claimOutboxBatch`](/api/events-tx/src/interfaces/transactionaleventstore/#claimoutboxbatch)

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

#### Implementation of

[`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/).[`findInboxRecord`](/api/events-tx/src/interfaces/transactionaleventstore/#findinboxrecord)

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

#### Implementation of

[`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/).[`findOutboxById`](/api/events-tx/src/interfaces/transactionaleventstore/#findoutboxbyid)

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

#### Implementation of

[`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/).[`findOutboxByIdempotencyKey`](/api/events-tx/src/interfaces/transactionaleventstore/#findoutboxbyidempotencykey)

***

### listInboxRecords()

> **listInboxRecords**(`options?`, `context?`): `Promise`\<[`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/)[]\>

#### Parameters

##### options?

[`ListInboxRecordsOptions`](/api/events-tx/src/type-aliases/listinboxrecordsoptions/) = `{}`

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/)[]\>

#### Implementation of

[`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/).[`listInboxRecords`](/api/events-tx/src/interfaces/transactionaleventstore/#listinboxrecords)

***

### listOutboxMessages()

> **listOutboxMessages**(`options?`, `context?`): `Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)[]\>

#### Parameters

##### options?

[`ListOutboxMessagesOptions`](/api/events-tx/src/type-aliases/listoutboxmessagesoptions/) = `{}`

##### context?

[`TransactionalEventStoreContext`](/api/events-tx/src/type-aliases/transactionaleventstorecontext/)\<`TClient`\>

#### Returns

`Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)[]\>

#### Implementation of

[`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/).[`listOutboxMessages`](/api/events-tx/src/interfaces/transactionaleventstore/#listoutboxmessages)

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

#### Implementation of

[`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/).[`markInboxFailed`](/api/events-tx/src/interfaces/transactionaleventstore/#markinboxfailed)

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

#### Implementation of

[`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/).[`markInboxProcessed`](/api/events-tx/src/interfaces/transactionaleventstore/#markinboxprocessed)

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

#### Implementation of

[`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/).[`markOutboxDeadLettered`](/api/events-tx/src/interfaces/transactionaleventstore/#markoutboxdeadlettered)

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

#### Implementation of

[`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/).[`markOutboxFailed`](/api/events-tx/src/interfaces/transactionaleventstore/#markoutboxfailed)

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

#### Implementation of

[`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/).[`markOutboxPublished`](/api/events-tx/src/interfaces/transactionaleventstore/#markoutboxpublished)

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

#### Implementation of

[`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/).[`startInboxProcessing`](/api/events-tx/src/interfaces/transactionaleventstore/#startinboxprocessing)
