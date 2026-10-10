# @croco/referral-drizzle

PostgreSQL persistence for `@croco/referral-core` programs, referral links,
attributions, benefit intents, clicks, and audit entries. Apply
`migrations/0001_referrals.up.sql` before use and
`migrations/0001_referrals.down.sql` to remove the tables.

`PostgresReferralStore` runs on a minimal `ReferralPgDatabase`
(`execute`/`transaction`) boundary so applications supply their own
node-postgres pool. Only link token hashes are persisted, never raw tokens.
First-valid attribution is enforced by a partial unique index on
`(family_id, recipient_key)`, so concurrent duplicate claims serialize and
later claimants are held instead of double-counted. Budget reservations use
atomic guarded updates against the program total, and attribution/benefit
states move with compare-and-set transitions. Stored documents revive
timestamps on read.

Live PostgreSQL coverage runs with `pnpm test:live` when
`REFERRALS_TEST_DATABASE_URL` is set; the default `pnpm test` runs only the
offline contract checks.
