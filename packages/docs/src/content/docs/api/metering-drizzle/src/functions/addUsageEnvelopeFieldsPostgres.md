---
editUrl: false
next: false
prev: false
title: "addUsageEnvelopeFieldsPostgres"
---

> **addUsageEnvelopeFieldsPostgres**(`db`): `Promise`\<`void`\>

PostgreSQL usage records에 typed usage envelope 컬럼과 event ID 조회 인덱스를 추가합니다.

이 helper는 인덱스를 transaction 안에서 생성하므로 대규모 `usage_records` 테이블에서는 쓰기를
차단할 수 있습니다. 그런 환경에서는 컬럼 변경을 먼저 적용한 뒤 아래 인덱스를 transaction 밖에서
별도 실행하세요.

`CREATE INDEX CONCURRENTLY IF NOT EXISTS usage_records_event_id_idx
ON usage_records (tenant_id, event_id) WHERE event_id IS NOT NULL`

## Parameters

### db

[`MeteringMigrationClient`](/api/metering-drizzle/src/type-aliases/meteringmigrationclient/)

## Returns

`Promise`\<`void`\>
