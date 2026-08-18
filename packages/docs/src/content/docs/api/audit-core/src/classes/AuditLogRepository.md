---
editUrl: false
next: false
prev: false
title: "AuditLogRepository"
---

감사 로그 저장소 추상 계약입니다.

## Extended by

- [`DrizzleAuditLogRepository`](/api/audit-drizzle/src/classes/drizzleauditlogrepository/)

## Constructors

### Constructor

> **new AuditLogRepository**(): `AuditLogRepository`

#### Returns

`AuditLogRepository`

## Methods

### create()

> `abstract` **create**(`entry`): `Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)\>

#### Parameters

##### entry

`Omit`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/), `"id"` \| `"createdAt"`\>

#### Returns

`Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)\>

---

### find()

> `abstract` **find**(`query`): `Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)[]\>

#### Parameters

##### query

[`AuditQuery`](/api/audit-core/src/type-aliases/auditquery/)

#### Returns

`Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)[]\>
