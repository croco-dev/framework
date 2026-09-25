---
editUrl: false
next: false
prev: false
title: "addMeterDefinitionFieldsSqlite"
---

> **addMeterDefinitionFieldsSqlite**(`db`): `Promise`\<`void`\>

SQLite meters에 `billing`, `aggregation`, `unit` 컬럼과 `(tenant_id, meter_id)` unique index를 추가합니다.

중복 행 처리는 `addMeterDefinitionFieldsPostgres`와 같습니다. `execute`는 `PRAGMA`와 `SELECT`의 결과 행을
반환해야 합니다.

## Parameters

### db

[`MeteringMigrationClient`](/api/metering-drizzle/src/type-aliases/meteringmigrationclient/)

## Returns

`Promise`\<`void`\>
