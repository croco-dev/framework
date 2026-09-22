---
editUrl: false
next: false
prev: false
title: "installTimescaleMetricsSchema"
---

> **installTimescaleMetricsSchema**(`db`): `Promise`\<`void`\>

Installs the same legacy metrics layout and converts its time-series tables to TimescaleDB
hypertables. This function explicitly enables the extension; ordinary PostgreSQL consumers must
use `installPostgresMetricsSchema` instead. The caller retains ownership when the supplied client
is already inside a transaction.

## Parameters

### db

[`MetricsPostgresClient`](/api/warehouse-postgres/src/metrics/interfaces/metricspostgresclient/)

## Returns

`Promise`\<`void`\>
