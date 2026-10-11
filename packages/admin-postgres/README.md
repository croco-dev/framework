# @croco/admin-postgres

PostgreSQL implementations of the Customer Explorer contracts in `@croco/admin-core`.
This provider package targets Node.js and accepts a structural PostgreSQL pool interface; the
application selects and owns its database driver. No source events are copied into explorer storage.

```typescript typecheck
import { PostgresCustomerExplorerRepository, type ExplorerPgDatabase } from "@croco/admin-postgres";

declare const pool: ExplorerPgDatabase;
const repository = new PostgresCustomerExplorerRepository(pool);
```

## Live timeline source

`PostgresTimelineSource` reads an application's existing normalized table through a validated `ExplorerSqlTimelineMapping`. Scope, subject and time predicates are parameterized before the per-subject `LIMIT`; keyset cursors bind the source, scope, subject and window, preserve PostgreSQL timestamp precision and order event keys with the `C` collation. Configure a source status callback that checks provider authorization and reports real coverage. A complete empty source and an unavailable source are different results.

## Persistence and migrations

`PostgresCustomerExplorerRepository` accepts a structural PostgreSQL pool interface, without choosing a driver. Apply the packaged `dist/migrations/0001_customer_explorer.up.sql` through your existing deployment migration owner. The repository performs no boot DDL. It stores only samples, notes, revision/actor audit records and snapshot content digests, not source logs. Note updates and their audits commit atomically. Deleted notes retain a content-free revision tombstone until sample deletion or expiry purge, so old writers cannot recreate an ID and overwrite new evidence; stale revisions fail with `customer-explorer/revision-conflict`.

Expiry prevents reads; call `purgeExpired(scope, now)` through a privileged retention job to delete expired sample data and cascading notes/audits. Explicit scoped sample deletion has the same cascade. Snapshot digests contain no source payload or membership list and remain after deletion to reject later content changes under the same snapshot ID. The schema is additive; rolling it back discards saved observations and requires the deployment owner's explicit data-retention decision.

## Verification

Run `pnpm --filter @croco/admin-postgres test` for the fast adapter tests. Set
`CUSTOMER_EXPLORER_TEST_DATABASE_URL` to an isolated PostgreSQL database and run
`pnpm --filter @croco/admin-postgres test:live` for migration, concurrency, deletion, retention and
pagination tests. The live suite creates and removes its own schema.

[Standalone PostgreSQL example](../../examples/customer-explorer/README.md) demonstrates source
mapping, authorization, migration setup and durable note rereads. Local synthetic verification does
not establish provider certification or production identity policy.
