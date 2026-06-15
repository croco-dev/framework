---
editUrl: false
next: false
prev: false
title: "AuditLogEntry"
---

> **AuditLogEntry** = `object`

감사 로그 엔트리, payload, 쿼리, 데코레이터 옵션 타입입니다.

## Properties

### action

> **action**: `string`

***

### actorId

> **actorId**: `string`

***

### createdAt

> **createdAt**: `Date`

***

### diff

> **diff**: `Record`\<`string`, `unknown`\> \| `null`

***

### id

> **id**: `string`

***

### integrityHash?

> `optional` **integrityHash**: `string`

***

### metadata

> **metadata**: `Record`\<`string`, `unknown`\>

***

### parentHash?

> `optional` **parentHash**: `string`

***

### payload

> **payload**: `Record`\<`string`, `unknown`\>

***

### resourceId

> **resourceId**: `string`

***

### resourceType

> **resourceType**: `string`

***

### sequence?

> `optional` **sequence**: `number`

***

### tenantId

> **tenantId**: `string`
