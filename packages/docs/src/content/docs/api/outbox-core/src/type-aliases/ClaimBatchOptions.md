---
editUrl: false
next: false
prev: false
title: "ClaimBatchOptions"
---

> **ClaimBatchOptions**\<`TClient`\> = `object`

## Type Parameters

### TClient

`TClient` = `unknown`

## Properties

### context?

> `readonly` `optional` **context?**: [`TransactionalOutboxStoreContext`](/api/outbox-core/src/type-aliases/transactionaloutboxstorecontext/)\<`TClient`\>

***

### dispatcherId?

> `readonly` `optional` **dispatcherId?**: `string`

***

### limit

> `readonly` **limit**: `number`

***

### now

> `readonly` **now**: `Date`

***

### tenant?

> `readonly` `optional` **tenant?**: [`OutboxTenantBoundary`](/api/outbox-core/src/type-aliases/outboxtenantboundary/)

***

### visibilityTimeoutMs

> `readonly` **visibilityTimeoutMs**: `number`
