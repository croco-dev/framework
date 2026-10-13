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

## Learning Registry persistence

`PostgresLearningRepository` implements `LearningRepository` from `@croco/admin-core` using the same
structural `ExplorerPgDatabase` pool interface. Apply the packaged
`dist/migrations/0002_learning_registry.up.sql` through the host's existing migration owner before use.
It is independent of the Customer Explorer migration and never runs DDL during construction or reads.

The additive tables store current records, full revision/audit history and command receipts. Scoped
transaction advisory locks serialize receipt identity and record CAS, including initially absent
records. CAS, history, audit and receipt share a PostgreSQL transaction; any insert failure rolls all
of them back. Identical retries return their original receipt; conflicting payloads and stale commands
have distinct Croco Problems. A storage failure never returns a reviewed success. Receipts and history
survive reconnection and host restart. Keep the tables when reverting code; dropping them permanently
removes saved records and retry protection and requires a separate retention decision.

Search and history SQL always bind app/environment/tenant and bounded pages. The service applies
current field policy before returning or matching any content. Hosts own authenticated sessions,
current privacy policy, evidence readers, database credentials and retention; the provider does not
claim production identity or provider certification from local synthetic tests.

The existing `test:live` command also exercises the Learning Registry migration, two-connection CAS,
exact retries, conflicting retries, atomic rollback and reconnection in its own temporary schema.
