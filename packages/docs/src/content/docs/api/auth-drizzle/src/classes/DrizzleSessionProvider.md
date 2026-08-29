---
editUrl: false
next: false
prev: false
title: "DrizzleSessionProvider"
---

세션 저장소와 회수 기능을 Drizzle로 구현한 제공자입니다.

## Implements

- [`SessionProvider`](/api/auth-core/src/interfaces/sessionprovider/)

## Constructors

### Constructor

> **new DrizzleSessionProvider**(`db`, `schema`): `DrizzleSessionProvider`

Drizzle DB와 세션 스키마를 받아 제공자를 초기화합니다.

#### Parameters

##### db

`DrizzleDb`

##### schema

###### sessions

`PgTableWithColumns`\<\{ `columns`: \{ `abandonedAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"abandoned_at"`; `notNull`: `false`; `tableName`: `"sessions"`; \}, \{ \}, \{ \}\>; `clientId`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"client_id"`; `notNull`: `true`; `tableName`: `"sessions"`; \}, \{ \}, \{ \}\>; `createdAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"created_at"`; `notNull`: `true`; `tableName`: `"sessions"`; \}, \{ \}, \{ \}\>; `expireAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"expire_at"`; `notNull`: `false`; `tableName`: `"sessions"`; \}, \{ \}, \{ \}\>; `id`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgUUID"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `true`; `name`: `"id"`; `notNull`: `true`; `tableName`: `"sessions"`; \}, \{ \}, \{ \}\>; `lastActiveAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"last_active_at"`; `notNull`: `false`; `tableName`: `"sessions"`; \}, \{ \}, \{ \}\>; `status`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `"ended"` \| `"pending"` \| `"expired"` \| `"revoked"` \| `"active"` \| `"abandoned"` \| `"removed"` \| `"replaced"`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`"abandoned"`, `"active"`, `"pending"`, `"ended"`, `"expired"`, `"removed"`, `"replaced"`, `"revoked"`\]; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"status"`; `notNull`: `true`; `tableName`: `"sessions"`; \}, \{ \}, \{ \}\>; `updatedAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"updated_at"`; `notNull`: `true`; `tableName`: `"sessions"`; \}, \{ \}, \{ \}\>; `userId`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"user_id"`; `notNull`: `true`; `tableName`: `"sessions"`; \}, \{ \}, \{ \}\>; \}; `dialect`: `"pg"`; `name`: `"sessions"`; `schema`: `undefined`; \}\>

#### Returns

`DrizzleSessionProvider`

## Methods

### getSession()

> **getSession**(`sessionId`): `Promise`\<[`Session`](/api/auth-core/src/type-aliases/session/) \| `null`\>

세션 ID로 단일 세션을 조회합니다.

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<[`Session`](/api/auth-core/src/type-aliases/session/) \| `null`\>

#### Implementation of

[`SessionProvider`](/api/auth-core/src/interfaces/sessionprovider/).[`getSession`](/api/auth-core/src/interfaces/sessionprovider/#getsession)

---

### listSessions()

> **listSessions**(`options`): `Promise`\<[`SessionListResult`](/api/auth-core/src/type-aliases/sessionlistresult/)\>

사용자, 클라이언트, 상태 조건으로 세션 목록을 조회합니다.

#### Parameters

##### options

[`SessionListOptions`](/api/auth-core/src/type-aliases/sessionlistoptions/)

#### Returns

`Promise`\<[`SessionListResult`](/api/auth-core/src/type-aliases/sessionlistresult/)\>

#### Implementation of

[`SessionProvider`](/api/auth-core/src/interfaces/sessionprovider/).[`listSessions`](/api/auth-core/src/interfaces/sessionprovider/#listsessions)

---

### revokeAllSessions()

> **revokeAllSessions**(`userId`): `Promise`\<`void`\>

사용자의 활성 또는 대기 세션을 모두 revoked 상태로 전환합니다.

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`SessionProvider`](/api/auth-core/src/interfaces/sessionprovider/).[`revokeAllSessions`](/api/auth-core/src/interfaces/sessionprovider/#revokeallsessions)

---

### revokeSession()

> **revokeSession**(`sessionId`): `Promise`\<`void`\>

단일 세션을 revoked 상태로 전환합니다.

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`SessionProvider`](/api/auth-core/src/interfaces/sessionprovider/).[`revokeSession`](/api/auth-core/src/interfaces/sessionprovider/#revokesession)
