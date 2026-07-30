---
editUrl: false
next: false
prev: false
title: "addPlanVersionEntitlementsPostgres"
---

> **addPlanVersionEntitlementsPostgres**(`db`): `Promise`\<`void`\>

PostgreSQL entitlement tables에 immutable plan-version identity를 추가합니다.

기존 행을 임의 버전에 연결하지 않도록 새 컬럼은 nullable로 추가됩니다. 이후
`backfillPlanVersionEntitlementsPostgres`에 운영자가 검증한 명시적 mapping을 전달해야 합니다.

## Parameters

### db

[`EntitlementMigrationClient`](/api/entitlements-drizzle/src/type-aliases/entitlementmigrationclient/)

## Returns

`Promise`\<`void`\>
