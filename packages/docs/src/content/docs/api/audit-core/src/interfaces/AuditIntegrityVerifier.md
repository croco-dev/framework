---
editUrl: false
next: false
prev: false
title: "AuditIntegrityVerifier"
---

감사 로그 무결성 체인 검증에 사용하는 타입들입니다.

## Methods

### computeHash()

> **computeHash**(`entry`): `string`

#### Parameters

##### entry

`Omit`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/), `"integrityHash"`\>

#### Returns

`string`

---

### verify()

> **verify**(`entry`): `boolean`

#### Parameters

##### entry

[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)

#### Returns

`boolean`
