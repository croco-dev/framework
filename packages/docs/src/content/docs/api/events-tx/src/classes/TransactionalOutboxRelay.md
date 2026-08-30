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

### drain()

> **drain**(`signal?`): `Promise`\<[`OutboxRelayDrainResult`](/api/events-tx/src/type-aliases/outboxrelaydrainresult/)\>

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`OutboxRelayDrainResult`](/api/events-tx/src/type-aliases/outboxrelaydrainresult/)\>

---

### onShutdown()

> **onShutdown**(`signal?`): `Promise`\<`void`\>

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`void`\>

---

### publishBatch()

> **publishBatch**(`options?`): `Promise`\<[`OutboxRelayBatchResult`](/api/events-tx/src/type-aliases/outboxrelaybatchresult/)\>

#### Parameters

##### options?

[`OutboxRelayPublishOptions`](/api/events-tx/src/type-aliases/outboxrelaypublishoptions/) = `{}`

#### Returns

`Promise`\<[`OutboxRelayBatchResult`](/api/events-tx/src/type-aliases/outboxrelaybatchresult/)\>

---

### stop()

> **stop**(): `void`

#### Returns

`void`
