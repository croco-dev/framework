---
editUrl: false
next: false
prev: false
title: "OutboxRelayBatchResult"
---

> **OutboxRelayBatchResult** = `object`

## Properties

### claimed

> **claimed**: `number`

---

### deadLettered

> **deadLettered**: `number`

---

### poisoned

> **poisoned**: `number`

---

### published

> **published**: `number`

---

### released

> **released**: `number`

---

### results

> **results**: [`OutboxRelayMessageResult`](/api/events-tx/src/type-aliases/outboxrelaymessageresult/)[]

---

### scheduledRetry

> **scheduledRetry**: `number`

---

### staleClaimed

> **staleClaimed**: `number`

---

### status

> **status**: `"completed"` \| `"cancelled"` \| `"stopped"`
