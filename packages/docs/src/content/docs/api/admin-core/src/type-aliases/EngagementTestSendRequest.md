---
editUrl: false
next: false
prev: false
title: "EngagementTestSendRequest"
---

> **EngagementTestSendRequest** = `object`

## Properties

### actorId

> `readonly` **actorId**: `string`

---

### channel

> `readonly` **channel**: [`EngagementChannel`](/api/admin-core/src/type-aliases/engagementchannel/)

---

### data

> `readonly` **data**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

---

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

---

### messageId

> `readonly` **messageId**: `string`

---

### reason

> `readonly` **reason**: `string`

---

### target

> `readonly` **target**: \{ `endpoint`: `string`; `type`: `"allowlisted-endpoint"`; \} \| \{ `recipientId`: `string`; `type`: `"recipient"`; \}
