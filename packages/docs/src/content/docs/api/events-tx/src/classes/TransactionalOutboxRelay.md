---
editUrl: false
next: false
prev: false
title: "TransactionalOutboxRelay"
---

Claims visible outbox messages and publishes them in deterministic batches.

## Type Parameters

### TClient

`TClient` = `unknown`

## Constructors

### Constructor

> **new TransactionalOutboxRelay**\<`TClient`\>(`config`): `TransactionalOutboxRelay`\<`TClient`\>

#### Parameters

##### config

[`OutboxRelayConfig`](/api/events-tx/src/type-aliases/outboxrelayconfig/)\<`TClient`\>

#### Returns

`TransactionalOutboxRelay`\<`TClient`\>

## Methods

### publishBatch()

> **publishBatch**(`options?`): `Promise`\<[`OutboxRelayBatchResult`](/api/events-tx/src/type-aliases/outboxrelaybatchresult/)\>

#### Parameters

##### options?

`Partial`\<[`OutboxClaimOptions`](/api/events-tx/src/type-aliases/outboxclaimoptions/)\> = `{}`

#### Returns

`Promise`\<[`OutboxRelayBatchResult`](/api/events-tx/src/type-aliases/outboxrelaybatchresult/)\>
