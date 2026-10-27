# @croco/promotions-drizzle

PostgreSQL persistence for `@croco/promotions-core` policies, quotes, claims,
budget reservations, and audit entries. Apply
`migrations/0001_promotions.up.sql` before use and
`migrations/0001_promotions.down.sql` to remove the tables.

`PostgresPromotionStore` runs on a minimal `PromotionPgDatabase`
(`execute`/`transaction`) boundary so applications supply their own
node-postgres pool. Budget reservations use atomic guarded updates, so
concurrent reserves serialize against the policy total instead of
overspending it, and claim states move with compare-and-set transitions.
Stored documents revive timestamps on read.

Transactions explicitly select READ COMMITTED before running the callback.
Transactional logical-key lookups take a transaction advisory lock before
checking for an existing claim. Subject counting then locks the complete
app/environment/tenant/kind/id identity through commit or rollback, covering
family/cycle limits and stacking checks across policies. The normal reservation
path acquires logical key, subject, then policy budget row locks in that order;
custom transaction callbacks must preserve that order. Different subjects use
separate admission locks, while the existing shared policy budget row still
serializes budget updates. Same-subject reservations are serialized even when
stacking is allowed, so the subject limit remains atomic.

The supplied database must pin one PostgreSQL connection for the whole
transaction and allow the isolation statement before any callback queries.
Configure bounded lock waits and connection lifetimes for the host. Standalone
read methods do not acquire reservation locks. No schema migration is required;
during rollout, old writers must be drained before relying on the new admission
locks because advisory locks coordinate only cooperating writers.

Live PostgreSQL coverage runs with `pnpm test:live` when
`PROMOTIONS_TEST_DATABASE_URL` is set; the default `pnpm test` runs only the
offline contract checks.
