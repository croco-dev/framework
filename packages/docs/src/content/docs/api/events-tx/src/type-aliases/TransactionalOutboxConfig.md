---
editUrl: false
next: false
prev: false
title: "TransactionalOutboxConfig"
---

> **TransactionalOutboxConfig**\<`TClient`\> = `object`

## Type Parameters

### TClient

`TClient`

## Properties

### idFactory?

> `optional` **idFactory?**: () => `string`

#### Returns

`string`

---

### maxAttempts?

> `optional` **maxAttempts?**: `number`

---

### now?

> `optional` **now?**: () => `Date`

#### Returns

`Date`

---

### serializer?

> `optional` **serializer?**: [`EventSerializer`](/api/events-core/src/interfaces/eventserializer/)

---

### store

> **store**: [`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/)\<`TClient`\>

---

### txManager

> **txManager**: `Pick`\<[`TxManager`](/api/tx-core/src/classes/txmanager/)\<`TClient`\>, `"getClient"` \| `"isInTransaction"`\>
