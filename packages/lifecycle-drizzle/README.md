# @croco/lifecycle-drizzle

PostgreSQL persistence for bounded Journeys in `@croco/lifecycle-core`.

Apply `migrations/0001_journey.up.sql` with the application's migration runner, then pass a Drizzle PostgreSQL database exposing `execute(SQL)` to `new PostgresJourneyStore(database)`. Compose that store into `JourneyEngine`; the application supplies the existing task dispatcher and scheduler through `JourneyTaskBridge`.

The primary key includes app, environment and tenant. Missing tenant is rejected. The scoped reentry key has a database uniqueness constraint. Node receipts, command audits and action intents live in the episode JSON and commit in the same atomic PostgreSQL revision compare-and-set as the node and wake timestamp. Concurrent wake invocations can read the same revision, but only one can admit the logical action. Wake scanners acquire expiring claims with `FOR UPDATE SKIP LOCKED`; failed dispatch or process restart leaves the same episode/node eligible after lease expiration. Successful episode CAS clears its old claim. Listings fail explicitly above 1000 episodes per scope; wake scanning remains bounded by its requested batch. Every update preserves the pinned definition version and entry identity.

Admission is the dispatch fence. A pause winning the revision compare-and-set prevents admission; admission winning first makes the episode indeterminate and a subsequent pause fails explicitly. This cannot retract a provider call already admitted. A crash after admission preserves the intent and does not automatically replay the action; operator/provider reconciliation is required. PostgreSQL durability does not make the external provider call transactional.

Reads and writes use the application connection's normal READ COMMITTED isolation. `create` uses a second statement after a uniqueness conflict so it sees a concurrent winner after PostgreSQL releases its insertion lock. Do not wrap this store in a long-lived repeatable-read transaction.

The down migration drops all Journey episodes, including receipts, action intents and command audits. Export retained history before rollback; rollback is destructive. Reapplying the up migration after rollback creates an empty store.

Run deterministic tests with `pnpm --filter @croco/lifecycle-drizzle test`. Run real two-connection contention, connection restart, tenant isolation and migration rollback checks against an empty disposable database:

```sh
JOURNEY_TEST_DATABASE_URL=postgres://user:password@localhost/journey_test pnpm --filter @croco/lifecycle-drizzle test:live
```

The package is alpha. No production database or customer dispatch is exercised by these tests.
