---
editUrl: false
next: false
prev: false
title: "backfillPlanVersionEntitlementsPostgres"
---

> **backfillPlanVersionEntitlementsPostgres**(`db`, `mappings`): `Promise`\<`void`\>

운영자가 선택한 exact `PlanVersionRef` mapping으로 legacy entitlement 행을 backfill합니다.

이 함수는 최신 plan version을 조회하거나 추정하지 않습니다.

## Parameters

### db

[`EntitlementMigrationClient`](/api/entitlements-drizzle/src/type-aliases/entitlementmigrationclient/)

### mappings

readonly [`PlanVersionEntitlementMigrationMapping`](/api/entitlements-drizzle/src/type-aliases/planversionentitlementmigrationmapping/)[]

## Returns

`Promise`\<`void`\>
