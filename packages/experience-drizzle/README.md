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
