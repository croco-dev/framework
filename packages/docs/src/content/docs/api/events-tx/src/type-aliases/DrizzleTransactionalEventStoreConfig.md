---
editUrl: false
next: false
prev: false
title: "DrizzleTransactionalEventStoreConfig"
---

> **DrizzleTransactionalEventStoreConfig**\<`TDb`, `TClient`\> = `object`

## Type Parameters

### TDb

`TDb` *extends* [`DrizzleTransactionalEventStoreDb`](/api/events-tx/src/type-aliases/drizzletransactionaleventstoredb/)

### TClient

`TClient` *extends* [`DrizzleTransactionalEventStoreDb`](/api/events-tx/src/type-aliases/drizzletransactionaleventstoredb/) = `TDb`

## Properties

### db

> **db**: `TDb`

***

### tables?

> `optional` **tables?**: [`DrizzleTransactionalEventStoreTables`](/api/events-tx/src/type-aliases/drizzletransactionaleventstoretables/)

***

### txManager?

> `optional` **txManager?**: `Pick`\<[`TxManager`](/api/tx-core/src/classes/txmanager/)\<`TClient`\>, `"getClient"`\>
