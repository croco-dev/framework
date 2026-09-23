---
editUrl: false
next: false
prev: false
title: "MeteringProcessingClaim"
---

> **MeteringProcessingClaim** = `object`

## Properties

### delivery?

> `optional` **delivery?**: [`PendingMeteringDelivery`](/api/metering-core/src/type-aliases/pendingmeteringdelivery/)

---

### operationId

> **operationId**: `string`

---

### rejectedInput?

> `optional` **rejectedInput?**: `Pick`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/), `"value"` \| `"eventId"` \| `"dimensions"` \| `"metadata"`\>

---

### token

> **token**: [`IdempotencyClaim`](/api/metering-core/src/type-aliases/idempotencyclaim/)
