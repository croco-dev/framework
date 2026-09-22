---
editUrl: false
next: false
prev: false
title: "installPostgresMetricsSchema"
---

> **installPostgresMetricsSchema**(`db`): `Promise`\<`void`\>

Installs the legacy metrics tables on ordinary PostgreSQL without enabling TimescaleDB.
The caller retains ownership when the supplied client is already inside a transaction.

## Parameters

### db

[`MetricsPostgresClient`](/api/warehouse-postgres/src/metrics/interfaces/metricspostgresclient/)

## Returns

`Promise`\<`void`\>
