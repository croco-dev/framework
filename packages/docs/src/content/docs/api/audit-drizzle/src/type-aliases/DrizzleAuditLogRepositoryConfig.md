---
editUrl: false
next: false
prev: false
title: "DrizzleAuditLogRepositoryConfig"
---

> **DrizzleAuditLogRepositoryConfig** = `object`

감사 로그 저장소 초기화에 필요한 설정입니다.

## Properties

### deserializeJson?

> `optional` **deserializeJson?**: (`value`) => `unknown`

#### Parameters

##### value

`string`

#### Returns

`unknown`

---

### schema

> **schema**: [`AuditLogTable`](/api/audit-drizzle/src/type-aliases/auditlogtable/)

---

### serializeJson?

> `optional` **serializeJson?**: (`value`) => `string`

#### Parameters

##### value

`unknown`

#### Returns

`string`

---

### table

> **table**: `unknown`
