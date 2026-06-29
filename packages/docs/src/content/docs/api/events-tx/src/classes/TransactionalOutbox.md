---
editUrl: false
next: false
prev: false
title: "TransactionalOutbox"
---

Appends serialized domain events to a transactional outbox using the active `tx-core` client.

## Type Parameters

### TClient

`TClient` = `unknown`

## Constructors

### Constructor

> **new TransactionalOutbox**\<`TClient`\>(`config`): `TransactionalOutbox`\<`TClient`\>

#### Parameters

##### config

[`TransactionalOutboxConfig`](/api/events-tx/src/type-aliases/transactionaloutboxconfig/)\<`TClient`\>

#### Returns

`TransactionalOutbox`\<`TClient`\>

## Methods

### append()

> **append**(`event`, `options?`): `Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)\>

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

##### options?

[`OutboxAppendOptions`](/api/events-tx/src/type-aliases/outboxappendoptions/) = `{}`

#### Returns

`Promise`\<[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)\>
