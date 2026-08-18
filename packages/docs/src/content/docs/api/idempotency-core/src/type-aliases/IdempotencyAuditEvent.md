---
editUrl: false
next: false
prev: false
title: "IdempotencyAuditEvent"
---

> **IdempotencyAuditEvent** = `object`

## Properties

### fingerprint

> `readonly` **fingerprint**: `string`

***

### key

> `readonly` **key**: `string`

***

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### namespace

> `readonly` **namespace**: `string`

***

### source

> `readonly` **source**: [`IdempotencyKeySourceKind`](/api/idempotency-core/src/type-aliases/idempotencykeysourcekind/)

***

### storageKey

> `readonly` **storageKey**: `string`

***

### tenantId

> `readonly` **tenantId**: `string` \| `null`

***

### type

> `readonly` **type**: `"idempotency.reserved"` \| `"idempotency.replayed"` \| `"idempotency.in_flight"` \| `"idempotency.failed"` \| `"idempotency.conflict"`
