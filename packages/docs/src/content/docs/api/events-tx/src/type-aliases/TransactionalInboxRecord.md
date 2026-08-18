---
editUrl: false
next: false
prev: false
title: "TransactionalInboxRecord"
---

> **TransactionalInboxRecord** = `object`

## Properties

### attempts

> **attempts**: `number`

---

### consumerId

> **consumerId**: `string`

---

### createdAt

> **createdAt**: `Date`

---

### diagnostics

> **diagnostics**: [`TransactionalEventDiagnostic`](/api/events-tx/src/type-aliases/transactionaleventdiagnostic/)[]

---

### eventType

> **eventType**: `string`

---

### failedAt?

> `optional` **failedAt?**: `Date`

---

### failureReason?

> `optional` **failureReason?**: `string`

---

### inboxKey

> **inboxKey**: `string`

---

### lastError?

> `optional` **lastError?**: [`TransactionalEventError`](/api/events-tx/src/type-aliases/transactionaleventerror/)

---

### lockedUntil?

> `optional` **lockedUntil?**: `Date`

---

### messageId

> **messageId**: `string`

---

### metadata

> **metadata**: `Record`\<`string`, `unknown`\>

---

### processedAt?

> `optional` **processedAt?**: `Date`

---

### status

> **status**: [`InboxMessageStatus`](/api/events-tx/src/type-aliases/inboxmessagestatus/)

---

### updatedAt

> **updatedAt**: `Date`
