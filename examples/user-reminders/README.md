# User-owned reminders

This standalone example combines ReminderService, PostgreSQL reminder/occurrence/audit storage,
EngagementService, existing recipient preferences, owner settings and operator inspection.
The application registers the `tasks` topic and one email message; reminder input cannot change
that classification or target another resource. No Journey, Cohort or Contact Policy is needed.

Use a disposable PostgreSQL database. Migration is an explicit separate command; the server
never creates tables during ordinary startup. The migration seeds one synthetic user endpoint
and an explicit fixture preference. The local provider records a synthetic acceptance receipt
in PostgreSQL and sends no external message. Production hosts supply authenticated subject
resolution, server authorization, domain resource ownership, a native notification dispatcher,
and their deployment migration lifecycle.

```bash
pnpm install --frozen-lockfile
pnpm exec turbo build --filter=@croco/engagement-drizzle... --filter=@croco/admin-react... --filter=@croco/frontend-react... --filter=@croco/triggers-core...
export REMINDER_EXAMPLE_DATABASE_URL='postgres://postgres:local-password@127.0.0.1:5432/reminders'
pnpm --filter @croco-example/user-reminders migrate
pnpm --filter @croco-example/user-reminders dev
```

Open `http://127.0.0.1:4181/`. Preview the next local/UTC instant, then explicitly create or update.
The channel list comes from the host's registered binding. The displayed delivery grace starts
at 60 seconds to match a minute wake cadence and remains editable; zero means strict on-time
only. Missed recurrence backlog is skipped. Snooze accepts a UTC timestamp and moves only the
next occurrence; the weekly schedule resumes afterward. Cancel cannot recall accepted messages.
An operator can inspect outcomes or cancel with a reason; the operator cannot enable consent.

`ReminderDueTrigger.tick()` is the actual existing `@Cron` bridge. Supply verified subject
inventory from the host, register the method with the selected trigger host, and keep its
minute UTC wake independent of each user's timezone. The same handler is available via the
loopback example API and CLI:

```bash
pnpm --filter @croco-example/user-reminders tick
```

The CLI fails on HTTP/runner failure. The server fails before startup if its database URL is
missing; requests fail explicitly if tables have not been migrated. Loopback HTTP has fixed synthetic identities and is
an example boundary, not a production authentication implementation.

Admission durably writes `unknown` before invoking EngagementService. A cancellation completed
before admission prevents that dispatch; later cancellation cannot claim recall. An unknown
occurrence is never automatically resent after restart. Use ReminderService.reconcile with
provider query evidence, actor, reason and idempotency key; accepted results require execution
IDs. A confirmed non-acceptance closes that occurrence without replaying it.

The PostgreSQL suite covers two connections, concurrent claims/CAS, cancel/snooze/timezone
invalidation, policy outcomes, backlog, resource completion/deletion, unknown and restart.

```bash
ENGAGEMENT_POSTGRES_URL="$REMINDER_EXAMPLE_DATABASE_URL" pnpm --filter @croco/engagement-drizzle test:postgres
```

That suite creates/drops engagement tables; run it in a disposable database, separately from a
running example. Backend fixture policy results are verified alongside the real EngagementService
bridge suite. Browser captures use synthetic state only and remain outside shipped package files.
