---
"@croco/metrics-core": patch
"@croco/problems-core": patch
"@croco/warehouse-core": minor
"@croco/warehouse-postgres": patch
---

Reject metric timestamps and window bounds with impossible dates or times before they affect an aggregate or reach PostgreSQL. Valid offsets and supported fractional precision are preserved. Warehouse core exposes `parseWarehouseInstant` so metric consumers and the warehouse row codec share calendar validation.

The Problem registry points to the updated metric diagnostics.
