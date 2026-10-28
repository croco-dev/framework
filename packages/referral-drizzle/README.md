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

Subject receipt admission uses transaction-scoped advisory locks keyed by the
family, explicit cycle and full subject identity, shared across program revisions
and both benefit roles. Ordering, locks and counts use only `appId`, `environment`,
`tenantId`, `kind` and `id`; stored additional metadata is ignored when matching
receipts and does not require a data migration. Transactions select READ COMMITTED so a count after a
waiting lock observes the preceding commit even if the database default is
REPEATABLE READ. Supply a connection pinned through COMMIT/ROLLBACK, permit the
isolation statement before application queries, and configure bounded lock waits.
No schema migration is required. Drain older writers before deploying the service
and provider together. Before rollback, stop and drain writers and reconcile
outstanding attributions; older writers do not implement this admission protocol.

Benefit return ownership and receipts are optional `returnOperation` fields
in the existing JSON document. Transactional attribution reads lock the row,
so separate service processes observe one return operation before any external
debit. No SQL migration is needed. Deploy the updated store and service
together after draining older return handlers; see the referral-core README
for uncertain-return recovery and rollback requirements.

Live PostgreSQL coverage runs with `pnpm test:live` when
`REFERRALS_TEST_DATABASE_URL` is set; the default `pnpm test` runs only the
offline contract checks.
