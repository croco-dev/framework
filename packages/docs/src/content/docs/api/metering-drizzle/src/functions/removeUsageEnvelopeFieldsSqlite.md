---
editUrl: false
next: false
prev: false
title: "removeUsageEnvelopeFieldsSqlite"
---

> **removeUsageEnvelopeFieldsSqlite**(`db`): `Promise`\<`void`\>

SQLite usage records에서 typed usage envelope 컬럼을 제거합니다.

이 작업은 `event_id`와 `dimensions` 데이터를 영구 삭제하며 롤백할 수 없습니다. 실행 전에 백업하세요.
`ALTER TABLE ... DROP COLUMN`을 사용하므로 SQLite 3.35.0 이상이 필요합니다.

`transaction`을 제공하면 schema 검사와 변경을 한 transaction에서 실행합니다.
MigrationRunner처럼 이미 transaction-scoped client를 전달하는 호출자는 `execute`만 제공할 수 있습니다.

## Parameters

### db

[`MeteringMigrationClient`](/api/metering-drizzle/src/type-aliases/meteringmigrationclient/)

## Returns

`Promise`\<`void`\>
