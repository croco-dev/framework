---
editUrl: false
next: false
prev: false
title: "migrateLegacyMetricsSchema"
---

> **migrateLegacyMetricsSchema**(`db`): `Promise`\<`void`\>

Reconciles pre-event-key metrics tables before deploying the provider writer.

Stop every old and new metrics writer before invoking this migration. The migration preserves all
rows, claims every existing event key, and keeps the existing table names and column meanings.
TimescaleDB conversion is intentionally separate so ordinary PostgreSQL installations never need
the extension. The caller retains ownership when the supplied client is already inside a
transaction.

## Parameters

### db

[`MetricsPostgresClient`](/api/warehouse-postgres/src/metrics/interfaces/metricspostgresclient/)

## Returns

`Promise`\<`void`\>
