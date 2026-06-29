---
editUrl: false
next: false
prev: false
title: "TransactionalInboxConsumer"
---

Provides inbox idempotency for at-least-once event consumers.

## Type Parameters

### TClient

`TClient` = `unknown`

## Constructors

### Constructor

> **new TransactionalInboxConsumer**\<`TClient`\>(`config`): `TransactionalInboxConsumer`\<`TClient`\>

#### Parameters

##### config

[`TransactionalInboxConsumerConfig`](/api/events-tx/src/type-aliases/transactionalinboxconsumerconfig/)\<`TClient`\>

#### Returns

`TransactionalInboxConsumer`\<`TClient`\>

## Methods

### handle()

> **handle**(`message`, `handler`): `Promise`\<[`InboxConsumerResult`](/api/events-tx/src/type-aliases/inboxconsumerresult/)\>

#### Parameters

##### message

[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)

##### handler

(`message`) => `Promise`\<`void`\>

#### Returns

`Promise`\<[`InboxConsumerResult`](/api/events-tx/src/type-aliases/inboxconsumerresult/)\>
