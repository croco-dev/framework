---
editUrl: false
next: false
prev: false
title: "TransactionalInboxConsumerConfig"
---

> **TransactionalInboxConsumerConfig**\<`TClient`\> = `object`

## Type Parameters

### TClient

`TClient`

## Properties

### consumerId

> **consumerId**: `string`

***

### now?

> `optional` **now?**: () => `Date`

#### Returns

`Date`

***

### store

> **store**: [`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/)\<`TClient`\>

***

### throwOnError?

> `optional` **throwOnError?**: `boolean`

***

### txManager?

> `optional` **txManager?**: `Pick`\<[`TxManager`](/api/tx-core/src/classes/txmanager/)\<`TClient`\>, `"getClient"`\>

***

### visibilityTimeoutMs?

> `optional` **visibilityTimeoutMs?**: `number`
