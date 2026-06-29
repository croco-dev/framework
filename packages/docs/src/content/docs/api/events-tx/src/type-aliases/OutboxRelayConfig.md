---
editUrl: false
next: false
prev: false
title: "OutboxRelayConfig"
---

> **OutboxRelayConfig**\<`TClient`\> = `object`

## Type Parameters

### TClient

`TClient`

## Properties

### batchSize?

> `optional` **batchSize?**: `number`

***

### deadLetter?

> `optional` **deadLetter?**: (`message`) => `Promise`\<`void`\>

#### Parameters

##### message

[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)

#### Returns

`Promise`\<`void`\>

***

### now?

> `optional` **now?**: () => `Date`

#### Returns

`Date`

***

### publish

> **publish**: (`message`) => `Promise`\<`void`\>

#### Parameters

##### message

[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)

#### Returns

`Promise`\<`void`\>

***

### retry?

> `optional` **retry?**: `Partial`\<[`OutboxRelayRetryPolicy`](/api/events-tx/src/type-aliases/outboxrelayretrypolicy/)\>

***

### store

> **store**: [`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/)\<`TClient`\>

***

### txManager?

> `optional` **txManager?**: `Pick`\<[`TxManager`](/api/tx-core/src/classes/txmanager/)\<`TClient`\>, `"getClient"`\>

***

### visibilityTimeoutMs?

> `optional` **visibilityTimeoutMs?**: `number`
