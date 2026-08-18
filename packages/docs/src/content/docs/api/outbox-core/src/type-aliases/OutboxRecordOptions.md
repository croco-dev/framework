---
editUrl: false
next: false
prev: false
title: "OutboxRecordOptions"
---

> **OutboxRecordOptions**\<`TClient`\> = `object`

## Type Parameters

### TClient

`TClient` = `unknown`

## Properties

### availableAt?

> `readonly` `optional` **availableAt?**: `Date`

---

### context?

> `readonly` `optional` **context?**: [`TransactionalOutboxStoreContext`](/api/outbox-core/src/type-aliases/transactionaloutboxstorecontext/)\<`TClient`\>

---

### id?

> `readonly` `optional` **id?**: `string`

---

### now?

> `readonly` `optional` **now?**: `Date`

---

### retry?

> `readonly` `optional` **retry?**: [`OutboxRetryOptions`](/api/outbox-core/src/type-aliases/outboxretryoptions/)
