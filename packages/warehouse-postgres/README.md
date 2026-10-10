# @croco/warehouse-postgres

PostgreSQL-backed warehouse integrations live behind explicit subpaths. `/facts` stores typed fact
models and publishes validated snapshots. `/metrics` preserves the legacy metrics tables and API.

## Installation

```bash
pnpm add @croco/warehouse-postgres @croco/metrics-core
```

Install `@croco/warehouse-core` when using the fact provider.

## Fact warehouse

Use `@croco/warehouse-core` to compile a fact descriptor and validate normalized rows. Run
`installPostgresWarehouseSchema` and `installPostgresFactSchema` in an explicit deployment migration
before constructing the services. Neither constructors nor application startup perform DDL.

```typescript no-check
import { compileFact, defineFact, c } from "@croco/warehouse-core";
import {
  installPostgresWarehouseSchema,
  installPostgresFactSchema,
  PostgresWarehouseCatalog,
  PostgresWarehouseWriter,
  PostgresWarehouseReader,
} from "@croco/warehouse-postgres/facts";

const declaration = defineFact("captures", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One confirmed capture", key: ["captureId"] },
  columns: {
    captureId: c.id(),
    capturedAt: c.instant({ precision: "millisecond" }),
    currency: c.currencyCode(),
    amountMinor: c.moneyMinor({ currency: "currency", min: BigInt(0) }),
  },
  time: { event: "capturedAt" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
});

const descriptor = await compileFact(declaration);
await installPostgresWarehouseSchema(migrationClient);
await installPostgresFactSchema(migrationClient, descriptor);

const resolveAccess = () => serverAuthenticatedWarehouseAccess();
const catalog = new PostgresWarehouseCatalog(pool, descriptor, resolveAccess);
const writer = new PostgresWarehouseWriter(pool, descriptor, resolveAccess);
const reader = new PostgresWarehouseReader(
  pool,
  descriptor,
  resolveAccess,
  cursorEncryptionSecret,
  cancellationPool,
);
```

The application supplies a transaction pool and a separate cancellation pool with reserved capacity.
Use the same PostgreSQL database for metadata and facts; the pool and database credentials are explicit application
configuration. A separate pool controls concurrency but does not isolate PostgreSQL CPU or I/O.
The resolver must read the current server-authenticated scope, actor, roles, permitted columns,
permission epoch, and privacy epoch for each operation. Untrusted rows, filters, and cursors cannot
choose those values. Change the permission epoch when authorization policy changes and call
`synchronizePermissionEpoch` with an actor, reason, expected revision, and idempotency key before
serving reads under the new policy.

Create an unpublished candidate with the current head and revision, write stable batch IDs, and
seal it with an explicit list of durable receipts and complete source coverage. A commit response
failure returns an indeterminate receipt: call `reconcileReceipt` before retrying the same batch.
Publication checks the candidate fence, quality, current head, and revision in one transaction.
Aggregate replacements name a complete date/series range, including a verified empty range.
Readers pin a snapshot ID and use an encrypted keyset cursor for later pages; an advanced head does not alter
that snapshot. Changed permission/privacy epochs or expired snapshots fail explicitly. The reader
limits rows, bytes, time, and concurrent requests and cancels PostgreSQL work on client abort.

Each semantic model generation gets one ordinary typed PostgreSQL table with `BIGINT`, exact
`NUMERIC`, `DATE`, `TIMESTAMPTZ`, `BOOLEAN`, and `TEXT` columns. No TimescaleDB extension is needed.
Old row versions remain available while snapshots referencing their revisions are retained.
Each snapshot references the model's single physical table; its revision selects the visible
logical rows, so publication metadata does not grow with batch count. `expireSnapshots` marks old
non-head snapshots unavailable and prunes closed physical rows older than every retained snapshot.
It also abandons open or sealed candidates older than the cutoff and removes old failed staging,
receipts, unreferenced candidate records, expired snapshot metadata, and mutation outcomes.
Call it as an explicit retention job; idempotency keys whose outcomes have aged past the cutoff
must not be replayed. A retained active snapshot keeps the row versions it needs. The synthetic
PostgreSQL test publishes 24 batches into one fact table, checks one physical row per new fact
and one table reference per snapshot, and verifies failed staging cleanup. PostgreSQL CPU and I/O
remain shared with other work; set pool sizes and read concurrency for the application workload.
`suppress` deletes matching physical rows, keeps a tombstone against reimport, and advances the
privacy epoch. These operations require the `drop` role and audited requests.

## Native fact metrics

`PostgresWarehouseReader.readMetric` executes a trusted `metrics-core` definition against an
explicitly pinned warehouse snapshot. `count`, `sum`, `min`, `max`, exact distinct, sum/count
average, ratio, equality filters, and day/month buckets run as native PostgreSQL aggregates.
Money requires a currency filter or group. Integer and decimal results remain decimal strings;
ratios and averages retain numerator/denominator and use 12-digit half-even rounding. The provider
formats only bounded aggregate results in JavaScript and never downloads fact rows to emulate SQL.

```typescript no-check
import { defineMetric, project, sum } from "@croco/metrics-core";

// descriptor comes from compileFact; access is resolved by the server.
const definition = defineMetric("cash_received", {
  version: 1,
  from: descriptor,
  measure: sum(project(descriptor, "amountMinor")),
  groupByRequired: [project(descriptor, "currency")],
  time: project(descriptor, "capturedAt"),
  population: "server-confirmed-captures",
  unit: "currency-minor",
});
const snapshot = await catalog.pinSnapshot({ access });
const result = await reader.readMetric({
  access,
  snapshotId: snapshot.id,
  definition,
  window: { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" },
  maxRows: 100,
  maxBytes: 65536,
  timeoutMs: 5000,
  signal,
});
```

Register the executor in the existing `MetricReadService`; supply the pinned snapshot in its
trusted context and preserve the definition identity, source revisions, window, population,
field permissions, and actual snapshot quality in `MetricReadResult`. API, CLI/MCP and
`MetricInspector` continue to consume that service. Hosts map unknown/incomplete warehouse
quality to explicit partial results and set freshness using their source contract, never just
`MAX(eventTime)`. The existing [standalone/report example](../../examples/metric-read/README.md)
requires no database. The [native registered-query fixture](src/tests/PostgresMetricRead.integration.spec.ts)
is executable with `pnpm --filter @croco/warehouse-postgres test:integration` and uses temporary
PostgreSQL with synthetic rows.

The native read uses `BEGIN READ ONLY` and works with a SELECT-only database role. Provision
schema and publications with separate writer credentials. The cancellation pool must connect to
the same database and be authorized to cancel its reader backends. The reader enforces field
permissions, row/byte/time/concurrency limits and abort; the registered service additionally
owns window and cost capabilities. Configure PostgreSQL resource limits for scan cost: output
limits do not estimate scanned rows or physical database cost.

The aggregate response is complete or fails on its row/byte bound; it has no pagination or
implicit truncation. Drilldowns use `read` with `result.snapshot.id` and its encrypted cursor,
so later head publications cannot repin the read. Current server access and database epochs are
checked before returning aggregates; changed privacy/permission, expiration and suppression
remain explicit failures. This path does not introduce a cache or claim simultaneous observation
across independent sources. Empty sum/count are zero; empty extrema fail and zero denominators
remain null. Nullable group/time columns, timestamp windows finer than PostgreSQL microseconds,
cross-fact joins and quantiles are unsupported, rather than approximated or evaluated over a
full-row download.

## Metrics integration

```typescript no-check
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

```typescript no-check
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
