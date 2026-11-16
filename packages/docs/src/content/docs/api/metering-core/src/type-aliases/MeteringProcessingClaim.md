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

### persistence?

> `optional` **persistence?**: `object`

#### usageRecord?

> `optional` **usageRecord?**: [`PendingMeteringDelivery`](/api/metering-core/src/type-aliases/pendingmeteringdelivery/)\[`"usageRecord"`\]

---

### rejectedInput?

> `optional` **rejectedInput?**: `Pick`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/), `"value"` \| `"eventId"` \| `"dimensions"` \| `"metadata"`\>

---

### token

> **token**: [`IdempotencyClaim`](/api/metering-core/src/type-aliases/idempotencyclaim/)

---

### writeGeneration?

> `optional` **writeGeneration?**: `number`
