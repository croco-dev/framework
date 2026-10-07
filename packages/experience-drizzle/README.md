# @croco/experience-drizzle

PostgreSQL persistence for `@croco/experience-core`. Apply
`migrations/0001_experience.up.sql` before constructing `PostgresExperienceStore` with a
Drizzle PostgreSQL database that supplies `execute` and `transaction`.

Configuration revisions and decisions are immutable. The current pointer changes by
expected revision, actor, reason, and idempotency key. The adapter reads the current
pointer on every decision; it has no in-process configuration cache. A committed pause
therefore affects decisions started after the pause transaction, while already issued
decisions and visible UI are not recalled. A decision and its copied content remain
readable after later configuration changes.

Reservation and dismissal use a transaction advisory lock over scope, placement, and
subject. An unconfirmed reservation counts against frequency until its `expiresAt`;
confirmed displays remain counted for the configured window. Confirming a display
requires the server-issued handle and authenticated scope and subject. Repeating the
same confirmation returns `duplicate`; a separate display uses a new decision and
exposure identity. A reservation that expires without confirmation does not become an
exposure. Dismissal persists for the subject and configuration ID across revisions.

The adapter never fetches warehouse or cohort source data. Applications pass a
`PublishedCohortReader` to experience evaluation when cohort targeting is configured.
The reader's privacy and expiry checks remain authoritative.

`EXPERIENCE_TEST_DATABASE_URL` enables the live PostgreSQL test. It uses two pools to
exercise competing reservations and then reconnects to check persistence. Use an
isolated, disposable database: the test applies and drops the package migration.

## Saved Intent persistence

Apply `migrations/0002_saved_intent.up.sql` to add `PostgresSavedIntentStore`. This
migration is independent of the experience-decision tables; its down migration
removes only saved-intent state. Pass the same Drizzle PostgreSQL `execute` and
`transaction` boundary, then provide the store to `createSavedIntentService`.
Authorization and current resource resolution belong to that server service.

Each intent is unique within app/environment/tenant, subject kind/id, resource
type/id and explicit/recent source. Mutations take a shared subject lock plus
exclusive command and resource locks. They compare the expected revision and
commit the resulting intent together with an exact command receipt. A retry
returns the original result without undoing subsequent commands; changing a
semantic command input under the same key fails. Generated IDs and server times
are excluded from receipt equality. Policy history retains actor, reason,
revision and idempotency evidence, and accepts only an exact semantic replay.

Remove increments both source revisions, clears progress references and retains
a minimal resource suppression record. Recent activity cannot clear it; only an
explicit save can restore the resource. Retention purge deletes expired intent
payloads and receipt copies, including removed records, while keeping suppression.
Privacy deletion takes an exclusive subject lock and deletes all that subject's
intents, receipts and suppression records in one transaction. Applications must
also revoke the subject's write authorization when deleting an account; requests
authorized after deletion are new writes. Policies contain operator audit data
and are independent of the deleted subject's personal intents.

`pnpm --filter @croco/experience-drizzle test` runs deterministic SQL boundary
checks. `EXPERIENCE_TEST_DATABASE_URL=... pnpm --filter @croco/experience-drizzle
test:live` also verifies migration rollback/reapply, two-connection revision
competition, exact receipt replay, source suppression, scoped isolation,
retention, privacy erasure and adapter reconnection. Use a disposable PostgreSQL
database because live tests create and drop the package tables.
