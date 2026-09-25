---
"@croco/metering-drizzle": minor
"@croco/metering-core": patch
"@croco/problems-core": patch
---

Persist and restore `billing`, `aggregation`, and `unit` for Drizzle meter definitions, so billing-required meters stay `required` after registration and after a restart. Registering the same `(tenantId, meterId)` again now updates its single row instead of adding another one.

`metersPg` and `metersSqlite` add `billing` (not null, default `local`), `aggregation`, and `unit` columns plus the `meters_tenant_meter_unique` `(tenant_id, meter_id)` unique index, and `MeterTable` now requires mappings for the three columns. Run `addMeterDefinitionFieldsPostgres()` or `addMeterDefinitionFieldsSqlite()` before rolling out this version. The migration does not delete rows: when a `(tenant_id, meter_id)` is duplicated it fails with `DuplicateMeterDefinitionsProblem` (`metering-drizzle/duplicate-meter-definitions`) and lists every duplicate in `extensions.duplicates`. SQLite migration clients must return rows for `SELECT` as well as `PRAGMA`. Rows stored before the migration read as `billing: "local"`, so re-register billing-required meters after migrating. A `billing`, `aggregation`, or `unit` value outside the meter contract, whether passed to `save` or read from storage, fails with `InvalidMeterDefinitionProblem` (`metering-drizzle/invalid-meter-definition`). Re-registration replaces the whole definition: omitted `quota`, `aggregation`, `unit`, and `metadata` are cleared, `billing` becomes `local`, and `allowOverQuota` becomes `false`. Structural `DrizzleMeterDatabase` implementations must now support `insert().values().onConflictDoUpdate().returning()`. `MeterRepository.save` now documents that re-registration replaces the stored definition.
