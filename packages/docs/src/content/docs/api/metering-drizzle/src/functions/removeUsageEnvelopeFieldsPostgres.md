---
editUrl: false
next: false
prev: false
title: "removeUsageEnvelopeFieldsPostgres"
---

> **removeUsageEnvelopeFieldsPostgres**(`db`): `Promise`\<`void`\>

PostgreSQL usage records에서 typed usage envelope 컬럼을 제거합니다.

이 작업은 `event_id`와 `dimensions` 데이터를 영구 삭제하며 롤백할 수 없습니다. 실행 전에 백업하세요.

## Parameters

### db

[`MeteringMigrationClient`](/api/metering-drizzle/src/type-aliases/meteringmigrationclient/)

## Returns

`Promise`\<`void`\>
