---
editUrl: false
next: false
prev: false
title: "AuditSequenceGenerator"
---

감사 로그 무결성 체인 검증에 사용하는 타입들입니다.

## Methods

### generateNext()

> **generateNext**(`previousSequence?`): `number`

#### Parameters

##### previousSequence?

`number`

#### Returns

`number`

***

### validateOrder()

> **validateOrder**(`entries`): `boolean`

#### Parameters

##### entries

[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)[]

#### Returns

`boolean`
