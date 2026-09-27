# @croco/cohort-drizzle

PostgreSQL persistence and parameterized compilation for `@croco/cohort-core`.
Requires PostgreSQL 14+ (multirange coverage union) and a Drizzle node-postgres database implementing `CohortPgDatabase`.

Apply `migrations/0001_cohort.up.sql` before use. The corresponding down migration removes all cohort state; use it only after exporting retained publication history.

Register a `CohortSourceMapping` for an application-owned normalized snapshot table. Each row contains a unique text subject ID, explicit app/environment/tenant/subject-kind/snapshot columns, approved fact columns, JSONB events (`event`, `occurredAt`), coverage (`event`, `from`, `to`), and a JSONB string array of static memberships. Arrays must be present, including when empty. Snapshots must be retained and immutable. Scope is always bound in source queries; mappings are server configuration, never editor input. Registered enum values and field permissions come from core validation.

1. Call `saveDefinition` with the registration and authorization context.
2. Call `start` with a running `CohortRun` pinning one source snapshot, definition version, asOf and source watermarks.
3. Repeatedly call `materializePage` with the returned revision. Its checkpoint uses subject-ID keyset ordering. Recreate the store after restart and use the persisted revision; a stale revision or changed source content fails explicitly. Full source fingerprints are bounded by the configured row/cost limits and checked before every page. Registered mapping, permissions and enum contracts are also pinned. Source-table SHARE locks keep each bounded scan consistent, and scope advisory locks serialize publication and erasure. Source changes require a new run.
4. Call `publish` only after completion, supplying the metadata envelope, expected publication revision and actor/reason/idempotency key. `membershipRef` is the run ID and `contentHash` is `cohortContentHash` of matched IDs. PostgreSQL transaction locks serialize publication races; history retains immutable snapshot IDs. `withdraw` revokes an existing publication.
5. Use `checkpoint` to read persisted resume state and `current` to resolve the current pointer. `rollback` creates a new CAS publication from a retained valid snapshot after current privacy/suppression checks; it cannot extend validity. `eraseSubject` withdraws affected publications, invalidates affected runs, removes member explanations and the erased ID from withdrawn publication payloads (retaining the original snapshot hash for audit), and rejects replay of that subject from older source snapshots.
6. Pass the store to core `PublishedCohortReader`, which checks expiry, scope, schema, hash and current privacy before audience consumption. The source database is not queried while consuming an existing publication.

All AST operators compile from the same allowlisted mapping. SQL NULL preserves unknown through NOT. Event coverage uses unioned half-open intervals; distinct days use UTC. Every scanned result is checked against the shared evaluator, and a mismatch aborts its transaction. Provider failures propagate and do not become empty membership.

`pnpm test` runs compiler safety checks. To run the real PostgreSQL two-connection/restart/migration suite, set `COHORT_TEST_DATABASE_URL` to an isolated disposable test database and run `pnpm test:live`. The integration test replaces its named fixture tables; never point it at customer or production data.

Warehouse and CSV/JSONL profiles are not supplied: their prerequisite shared readers/query authorization/parser packages must land separately. This adapter directly supports normalized PostgreSQL source mappings.
