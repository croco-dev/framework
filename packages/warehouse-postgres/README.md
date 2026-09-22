# @croco/warehouse-postgres

PostgreSQL-backed warehouse integrations live behind explicit subpaths. The initial `/metrics`
integration preserves the legacy metrics tables without introducing the warehouse catalog or fact
pipeline planned separately.

## Installation

```bash
pnpm add @croco/warehouse-postgres @croco/metrics-core
```

## Metrics integration

```typescript
import {
  installPostgresMetricsSchema,
  PostgresMetricsStore,
} from "@croco/warehouse-postgres/metrics";

await installPostgresMetricsSchema(db);

const metricsRepository = new PostgresMetricsStore(db);
```

`PostgresMetricsStore` implements `MetricsRepository` from `@croco/metrics-core`. It preserves the
existing `mrr_movements`, `mrr_movement_event_keys`, and `metrics_snapshots` layout, event-key
idempotency, tenant filtering, amount meaning, timestamp boundaries, and retention calculations.
PostgreSQL `BIGINT` values are decoded to safe JavaScript integers because the core `Money` contract
uses `number`; values outside the safe-integer range fail explicitly instead of corrupting a metric.

### Plain PostgreSQL

`installPostgresMetricsSchema(db)` creates the existing relational layout and does not inspect,
install, or require TimescaleDB.

### TimescaleDB

```typescript
import { installTimescaleMetricsSchema } from "@croco/warehouse-postgres/metrics";

await installTimescaleMetricsSchema(db);
```

This explicit installer enables TimescaleDB and converts `mrr_movements` and `metrics_snapshots` to
monthly hypertables. Do not use it for ordinary PostgreSQL installations.

Schema installation is never performed by the store constructor or application startup implicitly.
Run the chosen installer through the deployment's migration process before starting writers.
Each schema helper runs as one atomic SQL batch without starting or committing a transaction. A
transaction-scoped client therefore keeps ownership of commit and rollback; a standalone call is
still rolled back by PostgreSQL if any statement in the batch fails.

## Migration from metrics-core

`@croco/metrics-core@0.1.0` is the last released package line that exposes
`TimescaleMetricsStore` and `PostgresClient`. Replace those imports as follows:

| Previous API                                       | Provider API                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| `TimescaleMetricsStore` from `@croco/metrics-core` | `PostgresMetricsStore` from `@croco/warehouse-postgres/metrics`  |
| `PostgresClient` from `@croco/metrics-core`        | `MetricsPostgresClient` from `@croco/warehouse-postgres/metrics` |

The current documented schema needs no data reload or table rename. Deployments created before the
tenant-global event-key table was introduced must stop every legacy and current metrics writer, run
`migrateLegacyMetricsSchema(db)`, deploy only the new writer, and then resume traffic. The migration
locks both metrics tables, backfills event-key claims, and preserves every existing row. TimescaleDB
deployments then run `installTimescaleMetricsSchema(db)` to retain hypertable support; plain
PostgreSQL deployments do not.

Do not run old and new writers between the final event-key reconciliation and deployment. This code
move does not drop tables, rewrite history, change metric denominators, or migrate legacy metrics into
the future warehouse fact model.
