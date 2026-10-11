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

Live PostgreSQL coverage runs with `pnpm test:live` when
`PROMOTIONS_TEST_DATABASE_URL` is set; the default `pnpm test` runs only the
offline contract checks.
