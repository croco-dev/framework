---
editUrl: false
next: false
prev: false
title: "TransactionalOutboxMessage"
---

> **TransactionalOutboxMessage** = `object`

## Properties

### aggregateId?

> `optional` **aggregateId?**: `string`

***

### attempts

> **attempts**: `number`

***

### createdAt

> **createdAt**: `Date`

***

### deadLetteredAt?

> `optional` **deadLetteredAt?**: `Date`

***

### deadLetterReason?

> `optional` **deadLetterReason?**: `string`

***

### diagnostics

> **diagnostics**: [`TransactionalEventDiagnostic`](/api/events-tx/src/type-aliases/transactionaleventdiagnostic/)[]

***

### eventId

> **eventId**: `string`

***

### eventType

> **eventType**: `string`

***

### id

> **id**: `string`

***

### idempotencyKey

> **idempotencyKey**: `string`

***

### lastError?

> `optional` **lastError?**: [`TransactionalEventError`](/api/events-tx/src/type-aliases/transactionaleventerror/)

***

### lockedUntil?

> `optional` **lockedUntil?**: `Date`

***

### maxAttempts

> **maxAttempts**: `number`

***

### metadata

> **metadata**: `Record`\<`string`, `unknown`\>

***

### occurredAt

> **occurredAt**: `Date`

***

### payload

> **payload**: `Record`\<`string`, `unknown`\>

***

### publishedAt?

> `optional` **publishedAt?**: `Date`

***

### status

> **status**: [`OutboxMessageStatus`](/api/events-tx/src/type-aliases/outboxmessagestatus/)

***

### traceContext?

> `optional` **traceContext?**: [`EventTraceContext`](/api/events-core/src/type-aliases/eventtracecontext/)

***

### updatedAt

> **updatedAt**: `Date`

***

### visibleAt

> **visibleAt**: `Date`
