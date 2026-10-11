---
editUrl: false
next: false
prev: false
title: "AnalyticsConsumerConfig"
---

> **AnalyticsConsumerConfig**\<`TClient`\> = `object`

## Type Parameters

### TClient

`TClient`

## Properties

### consumerId

> `readonly` **consumerId**: `string`

---

### mapRows

> `readonly` **mapRows**: (`envelope`, `message`) => `Promise`\<readonly [`CanonicalRow`](/api/warehouse-core/src/type-aliases/canonicalrow/)[]\>

Map the confirmed event to fact grain; the event id is not the grain.

#### Parameters

##### envelope

[`SourceEnvelope`](/api/etl-events-tx/src/type-aliases/sourceenvelope/)

##### message

[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)

#### Returns

`Promise`\<readonly [`CanonicalRow`](/api/warehouse-core/src/type-aliases/canonicalrow/)[]\>

---

### now?

> `readonly` `optional` **now?**: () => `Date`

#### Returns

`Date`

---

### quarantine

> `readonly` **quarantine**: [`QuarantineStore`](/api/etl-events-tx/src/interfaces/quarantinestore/)

---

### resolveBinding

> `readonly` **resolveBinding**: (`envelope`) => `Promise`\<`WarehouseCandidateRequest`\>

Resolve this only from the server's authenticated context and active candidate.

#### Parameters

##### envelope

[`SourceEnvelope`](/api/etl-events-tx/src/type-aliases/sourceenvelope/)

#### Returns

`Promise`\<`WarehouseCandidateRequest`\>

---

### sourceRef

> `readonly` **sourceRef**: `string`

---

### store

> `readonly` **store**: [`TransactionalEventStore`](/api/events-tx/src/interfaces/transactionaleventstore/)\<`TClient`\>

---

### visibilityTimeoutMs?

> `readonly` `optional` **visibilityTimeoutMs?**: `number`

---

### writer

> `readonly` **writer**: `WarehouseWriter`
