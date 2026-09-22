---
"@croco/metrics-core": major
"@croco/metrics-billing": patch
"@croco/warehouse-postgres": patch
---

Use `@croco/warehouse-postgres/metrics` for PostgreSQL and TimescaleDB metrics persistence. `metrics-core` now exposes only provider-neutral metric contracts and calculations; applications must replace `TimescaleMetricsStore` with `PostgresMetricsStore` and run the explicit schema path for their database.
