---
editUrl: false
next: false
prev: false
title: "addMeterDefinitionFieldsPostgres"
---

> **addMeterDefinitionFieldsPostgres**(`db`): `Promise`\<`void`\>

PostgreSQL meters에 `billing`, `aggregation`, `unit` 컬럼과 `(tenant_id, meter_id)` unique index를 추가합니다.

같은 `(tenant_id, meter_id)` 행이 여러 개 있으면 행을 삭제하지 않고 `DuplicateMeterDefinitionsProblem`으로
중복 목록과 함께 실패합니다. `transaction`을 제공하면 컬럼 추가도 롤백됩니다.

## Parameters

### db

[`MeteringMigrationClient`](/api/metering-drizzle/src/type-aliases/meteringmigrationclient/)

## Returns

`Promise`\<`void`\>
