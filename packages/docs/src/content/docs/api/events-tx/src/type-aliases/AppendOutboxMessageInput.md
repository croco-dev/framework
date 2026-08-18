---
editUrl: false
next: false
prev: false
title: "AppendOutboxMessageInput"
---

> **AppendOutboxMessageInput** = `object`

## Properties

### aggregateId?

> `optional` **aggregateId?**: `string`

***

### diagnostics?

> `optional` **diagnostics?**: [`TransactionalEventDiagnostic`](/api/events-tx/src/type-aliases/transactionaleventdiagnostic/)[]

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

### maxAttempts

> **maxAttempts**: `number`

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### occurredAt

> **occurredAt**: `Date`

***

### payload

> **payload**: `Record`\<`string`, `unknown`\>

***

### traceContext?

> `optional` **traceContext?**: [`EventTraceContext`](/api/events-core/src/type-aliases/eventtracecontext/)

***

### visibleAt

> **visibleAt**: `Date`
