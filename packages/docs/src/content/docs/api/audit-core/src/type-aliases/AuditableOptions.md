---
editUrl: false
next: false
prev: false
title: "AuditableOptions"
---

> **AuditableOptions**\<`T`\> = `object`

감사 로그 엔트리, payload, 쿼리, 데코레이터 옵션 타입입니다.

## Type Parameters

### T

`T` = `unknown`

## Properties

### action

> **action**: `string`

---

### dependencies

> **dependencies**: (`instance`) => `object`

#### Parameters

##### instance

`T`

#### Returns

`object`

##### logger

> **logger**: [`ILogger`](/api/framework-context/src/interfaces/ilogger/)

##### repository

> **repository**: [`AuditLogRepository`](/api/audit-core/src/classes/auditlogrepository/)

---

### includeResult?

> `optional` **includeResult?**: `boolean`

---

### payloadIndex?

> `optional` **payloadIndex?**: `number`

---

### resourceIdIndex?

> `optional` **resourceIdIndex?**: `number`

---

### resourceType

> **resourceType**: `string`

---

### throwOnFailure?

> `optional` **throwOnFailure?**: `boolean`
