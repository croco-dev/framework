---
editUrl: false
next: false
prev: false
title: "removeUsageEnvelopeFieldsSqlite"
---

> **removeUsageEnvelopeFieldsSqlite**(`db`): `Promise`\<`void`\>

SQLite usage records에서 typed usage envelope 컬럼을 제거합니다.

`transaction`을 제공하면 schema 검사와 변경을 한 transaction에서 실행합니다.
MigrationRunner처럼 이미 transaction-scoped client를 전달하는 호출자는 `execute`만 제공할 수 있습니다.

## Parameters

### db

[`MeteringMigrationClient`](/api/metering-drizzle/src/type-aliases/meteringmigrationclient/)

## Returns

`Promise`\<`void`\>
