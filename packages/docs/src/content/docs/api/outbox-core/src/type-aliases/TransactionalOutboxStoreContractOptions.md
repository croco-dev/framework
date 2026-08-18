---
editUrl: false
next: false
prev: false
title: "TransactionalOutboxStoreContractOptions"
---

> **TransactionalOutboxStoreContractOptions**\<`TStore`, `TClient`\> = `object`

## Type Parameters

### TStore

`TStore` *extends* [`TransactionalOutboxStore`](/api/outbox-core/src/interfaces/transactionaloutboxstore/)\<`TClient`\>

### TClient

`TClient` = `unknown`

## Properties

### createStore

> `readonly` **createStore**: () => `TStore` \| `Promise`\<`TStore`\>

#### Returns

`TStore` \| `Promise`\<`TStore`\>

***

### listRecords

> `readonly` **listRecords**: (`store`) => `Promise`\<readonly [`OutboxRecord`](/api/outbox-core/src/type-aliases/outboxrecord/)[]\>

#### Parameters

##### store

`TStore`

#### Returns

`Promise`\<readonly [`OutboxRecord`](/api/outbox-core/src/type-aliases/outboxrecord/)[]\>

***

### runInUnitOfWork

> `readonly` **runInUnitOfWork**: (`store`, `fn`) => `Promise`\<`void`\>

#### Parameters

##### store

`TStore`

##### fn

(`context`) => `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
