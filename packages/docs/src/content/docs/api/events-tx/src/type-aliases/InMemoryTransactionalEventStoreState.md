---
editUrl: false
next: false
prev: false
title: "InMemoryTransactionalEventStoreState"
---

> **InMemoryTransactionalEventStoreState** = `object`

## Properties

### inbox

> **inbox**: `Map`\<`string`, [`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/)\>

***

### outbox

> **outbox**: `Map`\<`string`, [`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)\>

***

### outboxIdByIdempotencyKey

> **outboxIdByIdempotencyKey**: `Map`\<`string`, `string`\>
