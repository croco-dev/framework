---
editUrl: false
next: false
prev: false
title: "OutboxIntent"
---

> **OutboxIntent** = `object`

## Properties

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

***

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### occurredAt?

> `readonly` `optional` **occurredAt?**: `Date`

***

### payload

> `readonly` **payload**: `Record`\<`string`, `unknown`\>

***

### source

> `readonly` **source**: [`OutboxSourceReference`](/api/outbox-core/src/type-aliases/outboxsourcereference/)

***

### tenant

> `readonly` **tenant**: [`OutboxTenantBoundary`](/api/outbox-core/src/type-aliases/outboxtenantboundary/)

***

### traceContext?

> `readonly` `optional` **traceContext?**: [`OutboxTraceContext`](/api/outbox-core/src/type-aliases/outboxtracecontext/)

***

### type

> `readonly` **type**: `string`
