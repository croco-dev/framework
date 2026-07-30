---
editUrl: false
next: false
prev: false
title: "planEntitlementSets"
---

> `const` **planEntitlementSets**: `PgTableWithColumns`\<\{ `columns`: \{ `createdAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"created_at"`; `notNull`: `false`; `tableName`: `"plan_entitlement_sets"`; \}, \{ \}, \{ \}\>; `planId`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"plan_id"`; `notNull`: `true`; `tableName`: `"plan_entitlement_sets"`; \}, \{ \}, \{ \}\>; `planVersionRef`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `true`; `name`: `"plan_version_ref"`; `notNull`: `true`; `tableName`: `"plan_entitlement_sets"`; \}, \{ \}, \{ \}\>; \}; `dialect`: `"pg"`; `name`: `"plan_entitlement_sets"`; `schema`: `undefined`; \}\>

발행된 플랜 버전별 entitlement set 식별자를 저장하는 PostgreSQL 스키마입니다.
