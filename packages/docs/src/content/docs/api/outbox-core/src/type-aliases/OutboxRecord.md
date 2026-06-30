---
editUrl: false
next: false
prev: false
title: "OutboxRecord"
---

> **OutboxRecord** = `object`

Provider-neutral transactional outbox storage contract.

## Properties

### availableAt

> `readonly` **availableAt**: `Date`

***

### claim?

> `readonly` `optional` **claim?**: [`OutboxClaim`](/api/outbox-core/src/type-aliases/outboxclaim/)

***

### createdAt

> `readonly` **createdAt**: `Date`

***

### dispatchResult?

> `readonly` `optional` **dispatchResult?**: [`DispatchResult`](/api/outbox-core/src/type-aliases/dispatchresult/)

***

### failure?

> `readonly` `optional` **failure?**: [`OutboxFailureRecord`](/api/outbox-core/src/type-aliases/outboxfailurerecord/)

***

### id

> `readonly` **id**: `string`

***

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

***

### metadata

> `readonly` **metadata**: `Record`\<`string`, `unknown`\>

***

### occurredAt

> `readonly` **occurredAt**: `Date`

***

### payload

> `readonly` **payload**: `Record`\<`string`, `unknown`\>

***

### retry

> `readonly` **retry**: [`OutboxRetryMetadata`](/api/outbox-core/src/type-aliases/outboxretrymetadata/)

***

### source

> `readonly` **source**: [`OutboxSourceReference`](/api/outbox-core/src/type-aliases/outboxsourcereference/)

***

### status

> `readonly` **status**: [`OutboxRecordStatus`](/api/outbox-core/src/type-aliases/outboxrecordstatus/)

***

### tenant

> `readonly` **tenant**: [`OutboxTenantBoundary`](/api/outbox-core/src/type-aliases/outboxtenantboundary/)

***

### traceContext?

> `readonly` `optional` **traceContext?**: [`OutboxTraceContext`](/api/outbox-core/src/type-aliases/outboxtracecontext/)

***

### type

> `readonly` **type**: `string`

***

### updatedAt

> `readonly` **updatedAt**: `Date`
