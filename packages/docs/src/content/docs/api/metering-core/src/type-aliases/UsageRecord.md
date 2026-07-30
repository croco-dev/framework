---
editUrl: false
next: false
prev: false
title: "UsageRecord"
---

> **UsageRecord** = `object`

사용량 기록

## Properties

### dimensions?

> `optional` **dimensions?**: `Record`\<`string`, `string` \| `number` \| `boolean`\>

***

### eventId?

> `optional` **eventId?**: `string`

***

### id

> **id**: `string`

***

### idempotencyKey

> **idempotencyKey**: `string`

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### meterId

> **meterId**: `string`

***

### tenantId

> **tenantId**: `string`

***

### timestamp

> **timestamp**: `Date`

***

### value

> **value**: `number`

Usage amount from 1 through 2_147_483_647, supported by every storage adapter.
