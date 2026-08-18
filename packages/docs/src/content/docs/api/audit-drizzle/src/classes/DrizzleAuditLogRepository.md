---
editUrl: false
next: false
prev: false
title: "DrizzleAuditLogRepository"
---

감사 로그 리포지토리를 Drizzle 기반으로 구현한 클래스입니다.

## Extends

- [`AuditLogRepository`](/api/audit-core/src/classes/auditlogrepository/)

## Constructors

### Constructor

> **new DrizzleAuditLogRepository**(`db`, `txManager`, `config`): `DrizzleAuditLogRepository`

DB, 트랜잭션 매니저, 스키마 설정을 받아 저장소를 초기화합니다.

#### Parameters

##### db

[`DrizzleDb`](/api/audit-drizzle/src/type-aliases/drizzledb/)

##### txManager

[`TxManager`](/api/tx-core/src/classes/txmanager/)\<[`DrizzleDb`](/api/audit-drizzle/src/type-aliases/drizzledb/)\>

##### config

[`DrizzleAuditLogRepositoryConfig`](/api/audit-drizzle/src/type-aliases/drizzleauditlogrepositoryconfig/)

#### Returns

`DrizzleAuditLogRepository`

#### Overrides

[`AuditLogRepository`](/api/audit-core/src/classes/auditlogrepository/).[`constructor`](/api/audit-core/src/classes/auditlogrepository/#constructor)

## Methods

### create()

> **create**(`entry`): `Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)\>

감사 로그 항목을 생성하고 저장된 결과를 반환합니다.

#### Parameters

##### entry

`Omit`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/), `"id"` \| `"createdAt"`\>

#### Returns

`Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)\>

#### Overrides

[`AuditLogRepository`](/api/audit-core/src/classes/auditlogrepository/).[`create`](/api/audit-core/src/classes/auditlogrepository/#create)

---

### find()

> **find**(`query`): `Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)[]\>

테넌트 기준으로 감사 로그를 조회합니다.

#### Parameters

##### query

[`AuditQuery`](/api/audit-core/src/type-aliases/auditquery/) & `object`

#### Returns

`Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)[]\>

#### Overrides

[`AuditLogRepository`](/api/audit-core/src/classes/auditlogrepository/).[`find`](/api/audit-core/src/classes/auditlogrepository/#find)

---

### findByActor()

> **findByActor**(`tenantId`, `actorId`, `options?`): `Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)[]\>

액터 기준으로 감사 로그를 조회합니다.

#### Parameters

##### tenantId

`string`

##### actorId

`string`

##### options?

###### endDate?

`Date`

###### limit?

`number`

###### offset?

`number`

###### startDate?

`Date`

#### Returns

`Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)[]\>

---

### findByDateRange()

> **findByDateRange**(`tenantId`, `startDate`, `endDate`, `options?`): `Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)[]\>

기간 범위로 감사 로그를 조회합니다.

#### Parameters

##### tenantId

`string`

##### startDate

`Date`

##### endDate

`Date`

##### options?

###### limit?

`number`

###### offset?

`number`

#### Returns

`Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)[]\>

---

### findByResource()

> **findByResource**(`tenantId`, `resourceType`, `resourceId`, `options?`): `Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)[]\>

리소스 기준으로 감사 로그를 조회합니다.

#### Parameters

##### tenantId

`string`

##### resourceType

`string`

##### resourceId

`string`

##### options?

###### limit?

`number`

###### offset?

`number`

#### Returns

`Promise`\<[`AuditLogEntry`](/api/audit-core/src/type-aliases/auditlogentry/)[]\>
